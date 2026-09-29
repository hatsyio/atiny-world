import type { Sql } from 'postgres'

import { currentUser } from '@clerk/nextjs/server'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { completeProfile } from '@/server/auth/profiles'
import { getSessionIdentity, type SessionIdentity } from '@/server/auth/session'

export const MAX_DISPLAY_NAME_LENGTH = 64
export type ProfileSessionReader = () => Promise<SessionIdentity | null>
export type ClerkUserReader = () => Promise<{
  id: string
  username: string | null
  unsafeMetadata: Record<string, unknown>
} | null>

export function validateDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name.length > 0 && Array.from(name).length <= MAX_DISPLAY_NAME_LENGTH ? name : null
}

export async function completeProfileForSession(
  sql: Sql,
  readAuth: ProfileSessionReader = getSessionIdentity,
  readClerkUser: ClerkUserReader = currentUser,
): Promise<ActionResult<{ profilePublicId: string }>> {
  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const user = await readClerkUser()
  if (!user || user.id !== identity.clerkUserId) {
    return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })
  }

  // Older sign-ups already stored a chosen public name in unsafe metadata.
  const displayName = validateDisplayName(user.username ?? user.unsafeMetadata.publicName)
  if (!displayName) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { username: 'profile.usernameRequired' },
    })
  }

  const completed = await completeProfile(sql, {
    clerkUserId: identity.clerkUserId,
    displayName,
  })
  return completed.ok ? okResult({ profilePublicId: completed.data.publicId }) : completed
}
