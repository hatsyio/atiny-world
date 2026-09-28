import type { Sql } from 'postgres'

import { errorResult, okResult, parsePublicId, type ActionResult } from '@/domain/contracts'

export type DeleteMessageInput = {
  clerkUserId: string
  publicId: string
  expectedVersion: number
  confirmation: true
}

// Borra físicamente sin tocar `last_message_created_at`. Las referencias de
// evidencia retenida se anulan de forma declarativa mediante el FK de
// `review_requests.message_id [...] ON DELETE SET NULL` que define US4.
export async function deleteMessage(
  sql: Sql,
  input: DeleteMessageInput,
): Promise<ActionResult<{ deleted: true }>> {
  const publicId = parsePublicId(input.publicId)
  if (!publicId.ok) return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' })

  return sql.begin(async (tx) => {
    const profiles = await tx<{ id: string; account_state: string; display_name: string }[]>`
      select id, account_state, display_name
        from app_private.profiles
       where clerk_user_id = ${input.clerkUserId}
       for update
    `
    const profile = profiles[0]
    if (!profile || !profile.display_name.trim()) return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
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

    await tx`delete from app_private.messages where id = ${message.id}`

    return okResult({ deleted: true as const })
  })
}
