import type { Sql } from 'postgres'
import { okResult, parsePublicId, type MessageStatus } from '@/domain/contracts'
import { availableModerationDecisions, canModerate, validateModerationDecision } from '@/domain/moderation/policies'
import { isMessagePublic } from '@/domain/messages/visibility'

type ModerationProfile = { id: string; clerk_user_id: string; role: string; account_state: 'active' | 'deletion_pending'; suspended_at: string | null; display_name: string }
export type ModerateMessageInput = { clerkUserId: string; publicId: string; expectedVersion: number; decision: string; reasonCode?: string; note?: string }
export type ModerateMessageSuccess = { publicId: string; status: MessageStatus; version: number }

export type ModerateMessageResult =
  | { ok: true; data: ModerateMessageSuccess }
  | { ok: false; error: { code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'MESSAGE_VERSION_CONFLICT' | 'INVALID_MODERATION_TRANSITION' } }

export async function moderateMessage(sql: Sql, input: ModerateMessageInput): Promise<ModerateMessageResult> {
  const publicId = parsePublicId(input.publicId)
  const validated = validateModerationDecision(input)
  if (!publicId.ok || !validated.ok || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 || input.expectedVersion >= 2147483647) {
    return { ok: false, error: { code: 'VALIDATION_ERROR' } }
  }
  const { decision, reasonCode, note } = validated.data
  return sql.begin(async tx => {
    // All profile locks precede message locks, matching author edits/deletions.
    // SHARE blocks role revocation/suspension until commit without serializing unrelated decisions.
    const profiles = await tx<ModerationProfile[]>`
      select id, clerk_user_id, role, account_state, suspended_at, display_name
      from app_private.profiles
      where clerk_user_id = ${input.clerkUserId}
         or id = (select author_id from app_private.messages where public_id = ${publicId.value})
      order by id for share
    `
    const actor = profiles.find(row => row.clerk_user_id === input.clerkUserId)
    if (!actor || !canModerate({ role: actor.role, accountState: actor.account_state, suspendedAt: actor.suspended_at, displayName: actor.display_name })) {
      return { ok: false, error: { code: 'NOT_FOUND' } }
    }
    const settings = await tx<{ premoderation_enabled: boolean }[]>`select premoderation_enabled from app_private.settings where id = 1 for share`
    if (!settings[0]) throw new Error('Missing application settings')
    const messages = await tx<{ id: string; author_id: string; version: number; status: MessageStatus }[]>`
      select id, author_id, version, status from app_private.messages
      where public_id = ${publicId.value} for update
    `
    const message = messages[0]
    const author = profiles.find(row => row.id === message?.author_id)
    if (!message || !author || author.account_state !== 'active') return { ok: false, error: { code: 'NOT_FOUND' } }
    if (message.version !== input.expectedVersion) return { ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } }
    const publicVisible = isMessagePublic({ messageStatus: message.status, premoderationEnabled: settings[0].premoderation_enabled, accountState: author.account_state, suspendedAt: author.suspended_at })
    if (!availableModerationDecisions(message.status, publicVisible).includes(decision)) return { ok: false, error: { code: 'INVALID_MODERATION_TRANSITION' } }
    const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'withdrawn'
    const version = message.version + 1
    await tx`
      update app_private.messages set status = ${status}, version = ${version},
        moderation_reason_code = ${reasonCode}, moderation_note = ${note}, updated_at = now()
      where id = ${message.id}
    `
    await tx`
      insert into app_private.moderation_actions
        (actor_id, action, message_id, message_public_id, message_version, subject_profile_id, reason_code, note)
      values (${actor.id}, ${decision}, ${message.id}, ${publicId.value}, ${message.version}, ${author.id}, ${reasonCode}, ${note})
    `
    await tx`
      insert into app_private.admin_audit (actor_id, action, target_type, target_public_id, reason_code, metadata)
      values (${actor.id}, ${decision}, 'message', ${publicId.value}, ${reasonCode},
        ${tx.json({ previousStatus: message.status, status, messageVersion: message.version, resultingVersion: version })})
    `
    return okResult({ publicId: publicId.value, status, version })
  })
}
