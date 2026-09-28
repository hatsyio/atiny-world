import { randomUUID } from 'node:crypto'

import type { Sql } from 'postgres'

import { errorResult, okResult, type ActionResult, type Recipient } from '@/domain/contracts'
import { validateMessageContent } from '@/domain/messages/content'
import { isMessagePublic } from '@/domain/messages/visibility'
import { approximatePublicPoint, validatePublicLocation, type PublicPoint } from '@/domain/location/public-point'

export type CreateMessageInput = {
  clerkUserId: string
  content: string
  recipient: Recipient
  location: {
    precision: 'approximate' | 'precise'
    localityCenter: PublicPoint
    country: string
    countryCode: string
    confirmed?: boolean
  }
}

export async function createMessage(
  sql: Sql,
  input: CreateMessageInput,
): Promise<ActionResult<{ publicId: string; status: 'pending'; publicVisible: boolean }>> {
  const content = validateMessageContent(input.content, { recipient: input.recipient })
  const location = validatePublicLocation({
    ...input.location.localityCenter,
    precision: input.location.precision,
    confirmed: input.location.confirmed,
  })
  if (!content.ok || !location.ok) return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' })

  return sql.begin(async (tx) => {
    const profiles = await tx<{ id: string; account_state: string; suspended_at: string | null; display_name: string }[]>`
      select id, account_state, suspended_at, display_name
        from app_private.profiles
       where clerk_user_id = ${input.clerkUserId}
       for update
    `
    const profile = profiles[0]
    if (!profile || !profile.display_name.trim()) return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
    if (profile.suspended_at) return errorResult('ACCOUNT_SUSPENDED', { messageKey: 'account.suspended' })
    if (profile.account_state !== 'active') return errorResult('PROFILE_INCOMPLETE', { messageKey: 'account.unavailable' })

    const settings = (await tx<{ message_limit: number; cooldown_seconds: number; premoderation_enabled: boolean }[]>`select message_limit, cooldown_seconds, premoderation_enabled from app_private.settings where id = 1`)[0]
    const count = (await tx<{ count: string }[]>`select count(*)::text as count from app_private.messages where author_id = ${profile.id}`)[0]
    if (Number(count.count) >= settings.message_limit) return errorResult('MESSAGE_LIMIT_REACHED', { messageKey: 'message.limitReached' })
    const latest = (await tx<{ created_at: string | null; now: string }[]>`
      select max(created_at)::text as created_at, clock_timestamp()::text as now
        from app_private.messages where author_id = ${profile.id}
    `)[0]
    if (latest.created_at) {
      const remaining = settings.cooldown_seconds - Math.floor((Date.parse(latest.now) - Date.parse(latest.created_at)) / 1000)
      if (remaining > 0) return errorResult('MESSAGE_COOLDOWN_ACTIVE', { messageKey: 'message.cooldown', retryAfterSeconds: remaining })
    }
    const publicId = randomUUID()
    const point = input.location.precision === 'approximate'
      ? approximatePublicPoint(location.data, publicId)
      : location.data
    await tx`
      insert into app_private.messages (public_id, author_id, content, recipient, status, location_precision, location_algorithm_version, public_point, locality, country, country_code)
      values (${publicId}, ${profile.id}, ${input.content}, ${input.recipient}, 'pending', ${input.location.precision}, ${input.location.precision === 'approximate' ? 1 : null}, ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography, null, ${input.location.country}, ${input.location.countryCode})
    `
    await tx`update app_private.profiles set last_message_created_at = clock_timestamp(), updated_at = now() where id = ${profile.id}`
    return okResult({
      publicId,
      status: 'pending' as const,
      publicVisible: isMessagePublic({
        messageStatus: 'pending',
        premoderationEnabled: settings.premoderation_enabled,
        accountState: 'active',
        suspendedAt: null,
      }),
    })
  })
}
