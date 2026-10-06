import type { Sql } from 'postgres'
import { errorResult, okResult, isMessageStatus, type ActionResult, type MessageStatus } from '@/domain/contracts'
import { availableModerationDecisions, canModerate, type ModerationDecision } from '@/domain/moderation/policies'
import { visibilityCondition } from '@/server/messages/public-repository'

export type ModerationMessage = {
  publicId: string; version: number; status: MessageStatus; content: string
  authorName: string; authorState: 'active' | 'suspended' | 'deletion_pending'
  locality: string | null; country: string; publishedAt: string
  reasonCode: string | null; note: string | null; publicVisible: boolean; decisions: ModerationDecision[]
}
export type ModerationMessagePage = { items: ModerationMessage[]; hasMore: boolean }

export async function searchModerationMessages(sql: Sql, clerkUserId: string, options: { query: string; status: string; page: number }): Promise<ActionResult<ModerationMessagePage>> {
  if (options.query.length > 100 || (options.status !== 'all' && !isMessageStatus(options.status)) || !Number.isSafeInteger(options.page) || options.page < 1 || options.page > 10000) {
    return errorResult('VALIDATION_ERROR', { messageKey: 'admin.moderation.invalid' })
  }
  return sql.begin(async tx => {
    const actors = await tx<{ role: string; account_state: string; suspended_at: string | null; display_name: string }[]>`
      select role, account_state, suspended_at, display_name from app_private.profiles
      where clerk_user_id = ${clerkUserId} for share
    `
    const actor = actors[0]
    if (!actor || !canModerate({ role: actor.role, accountState: actor.account_state, suspendedAt: actor.suspended_at, displayName: actor.display_name })) return errorResult('NOT_FOUND', { messageKey: 'admin.moderation.denied' })
    const term = options.query.trim()
    const statusFilter = options.status === 'all' ? tx`true` : tx`m.status = ${options.status}`
    const rows = await tx<{
      public_id: string; version: number; status: MessageStatus; content: string; display_name: string
      account_state: string; suspended_at: string | null; locality: string | null; country: string
      published_at: string; moderation_reason_code: string | null; moderation_note: string | null; public_visible: boolean
    }[]>`
      select m.public_id, m.version, m.status, m.content, p.display_name, p.account_state,
        p.suspended_at, m.locality, m.country, m.published_at, m.moderation_reason_code,
        m.moderation_note, (${visibilityCondition(tx)}) as public_visible
      from app_private.messages m join app_private.profiles p on p.id = m.author_id
      where ${statusFilter} and (
        strpos(lower(m.content), lower(${term})) > 0
        or strpos(lower(p.display_name), lower(${term})) > 0
        or strpos(m.public_id::text, lower(${term})) > 0
      )
      order by m.published_at desc, m.id desc limit 26 offset ${(options.page - 1) * 25}
    `
    return okResult({
      hasMore: rows.length > 25,
      items: rows.slice(0, 25).map(row => ({
        publicId: row.public_id, version: row.version, status: row.status, content: row.content,
        authorName: row.display_name, authorState: row.account_state === 'deletion_pending' ? 'deletion_pending' : row.suspended_at ? 'suspended' : 'active',
        locality: row.locality, country: row.country, publishedAt: new Date(row.published_at).toISOString(),
        reasonCode: row.moderation_reason_code, note: row.moderation_note, publicVisible: row.public_visible,
        decisions: row.account_state === 'active' ? availableModerationDecisions(row.status, row.public_visible) : [],
      })),
    })
  })
}
