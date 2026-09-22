import type { Sql } from 'postgres'

import { errorResult, okResult, parsePublicId, type ActionResult } from '@/domain/contracts'
import { validateMessageContent } from '@/domain/messages/content'
import { approximatePublicPoint, validatePublicLocation } from '@/domain/location/public-point'
import type { CreateMessageInput } from './create-message'

export type UpdateMessageInput = {
  clerkUserId: string
  publicId: string
  expectedVersion: number
  content: string
  location?: CreateMessageInput['location']
}

export type UpdateMessageSuccess = {
  publicId: string
  version: number
  status: 'pending'
}

export async function updateMessage(
  sql: Sql,
  input: UpdateMessageInput,
): Promise<ActionResult<UpdateMessageSuccess>> {
  const content = validateMessageContent(input.content)
  if (!content.ok) return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' })

  const publicId = parsePublicId(input.publicId)
  if (!publicId.ok) return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' })

  let replacement: {
    precision: 'approximate' | 'precise'
    latitude: number
    longitude: number
    algorithmVersion: number | null
    locality: string | null
    country: string
    countryCode: string
  } | null = null
  if (input.location) {
    const location = validatePublicLocation({
      ...input.location.localityCenter,
      precision: input.location.precision,
      confirmed: input.location.confirmed,
    })
    if (!location.ok) return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' })
    const point = location.data.precision === 'approximate'
      ? approximatePublicPoint(location.data, publicId.value)
      : location.data
    replacement = {
      precision: location.data.precision,
      latitude: point.latitude,
      longitude: point.longitude,
      algorithmVersion: location.data.precision === 'approximate' ? 1 : null,
      locality: null,
      country: input.location.country,
      countryCode: input.location.countryCode,
    }
  }

  return sql.begin(async (tx) => {
    const profiles = await tx<{ id: string; account_state: string; suspended_at: string | null; username: string; display_name: string }[]>`
      select id, account_state, suspended_at, username, display_name
        from app_private.profiles
       where clerk_user_id = ${input.clerkUserId}
       for update
    `
    const profile = profiles[0]
    if (!profile || !profile.username.trim() || !profile.display_name.trim()) return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
    if (profile.suspended_at) return errorResult('ACCOUNT_SUSPENDED', { messageKey: 'account.suspended' })
    if (profile.account_state !== 'active') return errorResult('PROFILE_INCOMPLETE', { messageKey: 'account.unavailable' })

    const messages = await tx<{ id: string; public_id: string; version: number }[]>`
      select id, public_id, version
        from app_private.messages
       where public_id = ${publicId.value}
         and author_id = ${profile.id}
       for update
    `
    const message = messages[0]
    if (!message) return errorResult('NOT_FOUND', { messageKey: 'message.notFound' })
    if (message.version !== input.expectedVersion) return errorResult('MESSAGE_VERSION_CONFLICT', { messageKey: 'message.versionConflict' })

    const nextVersion = message.version + 1

    if (replacement) {
      await tx`
        update app_private.messages
           set content = ${input.content},
               version = ${nextVersion},
               status = 'pending',
               moderation_reason_code = null,
               moderation_note = null,
               location_precision = ${replacement.precision},
               location_algorithm_version = ${replacement.algorithmVersion},
               public_point = ST_SetSRID(ST_MakePoint(${replacement.longitude}, ${replacement.latitude}), 4326)::geography,
               locality = ${replacement.locality},
               country = ${replacement.country},
               country_code = ${replacement.countryCode},
               updated_at = now()
         where id = ${message.id}
      `
    } else {
      await tx`
        update app_private.messages
           set content = ${input.content},
               version = ${nextVersion},
               status = 'pending',
               moderation_reason_code = null,
               moderation_note = null,
               updated_at = now()
         where id = ${message.id}
      `
    }

    return okResult({ publicId: message.public_id, version: nextVersion, status: 'pending' as const })
  })
}