import type { Sql } from 'postgres'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'

export type CompleteProfileInput = {
  clerkUserId: string
  emailVerified: boolean
  username: string
  displayName: string
  identityProvider?: 'password' | 'google'
  role?: unknown
}

function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

export async function completeProfile(
  sql: Sql,
  input: CompleteProfileInput,
): Promise<ActionResult<{ publicId: string; username: string; displayName: string }>> {
  const username = input.username.trim()
  const displayName = input.displayName
  if (!input.emailVerified || username.length === 0 || displayName.trim().length === 0) {
    return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
  }

  try {
    const rows = await sql<{ public_id: string; username: string; display_name: string }[]>`
      insert into app_private.profiles (
        clerk_user_id, username, username_normalized, display_name
      ) values (
        ${input.clerkUserId}, ${username}, ${normalizeUsername(username)}, ${displayName}
      )
      on conflict (clerk_user_id) do update
        set username = excluded.username,
            username_normalized = excluded.username_normalized,
            display_name = excluded.display_name,
            updated_at = now()
      returning public_id, username, display_name
    `
    const row = rows[0]
    return okResult({ publicId: row.public_id, username: row.username, displayName: row.display_name })
  } catch {
    return errorResult('VALIDATION_ERROR', { messageKey: 'profile.usernameUnavailable' })
  }
}
