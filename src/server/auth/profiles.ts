import type { Sql } from 'postgres'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'

export type CompleteProfileInput = {
  clerkUserId: string
  emailVerified: boolean
  displayName: string
}

export async function completeProfile(
  sql: Sql,
  input: CompleteProfileInput,
): Promise<ActionResult<{ publicId: string; displayName: string }>> {
  const displayName = input.displayName.trim()
  if (!input.emailVerified || displayName.length === 0 || Array.from(displayName).length > 50) {
    return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
  }

  try {
    const rows = await sql<{ public_id: string; display_name: string }[]>`
      insert into app_private.profiles (clerk_user_id, display_name)
      values (${input.clerkUserId}, ${displayName})
      on conflict (clerk_user_id) do update
        set updated_at = app_private.profiles.updated_at
      returning public_id, display_name
    `
    const row = rows[0]
    return okResult({ publicId: row.public_id, displayName: row.display_name })
  } catch {
    return errorResult('INTERNAL_ERROR', { messageKey: 'profile.creationFailed' })
  }
}
