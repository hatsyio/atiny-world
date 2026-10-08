import type { Sql } from 'postgres'
import { currentUser } from '@clerk/nextjs/server'
import { errorResult, type ProblemEnvelope } from '@/domain/contracts'
import { completeProfile } from './profiles'
import { readProfileByClerkUserId, type ProfileReader, type SessionIdentity, type SessionProfileRow } from './session'

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

export type ProfileRecoveryResult =
  | { kind: 'available'; profile: SessionProfileRow }
  | { kind: 'incomplete'; error: ProblemEnvelope }
  | { kind: 'failed'; error: ProblemEnvelope }

// Owns the local-profile recovery sequence; navigation and cookies belong to callers.
export async function recoverProfile(
  sql: Sql,
  identity: SessionIdentity,
  readClerkUser: ClerkUserReader = currentUser,
  readProfile: ProfileReader = readProfileByClerkUserId,
): Promise<ProfileRecoveryResult> {
  try {
    const existing = await readProfile(sql, identity.clerkUserId)
    if (existing) return { kind: 'available', profile: existing }

    const user = await readClerkUser()
    if (!user || user.id !== identity.clerkUserId) {
      return { kind: 'failed', error: errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' }).error }
    }
    // Older sign-ups already stored a chosen public name in unsafe metadata.
    const displayName = validateDisplayName(user.username ?? user.unsafeMetadata.publicName)
    if (!displayName) {
      return { kind: 'incomplete', error: errorResult('VALIDATION_ERROR', {
        messageKey: 'validation.invalidFields',
        fieldErrors: { username: 'profile.usernameRequired' },
      }).error }
    }

    const completed = await completeProfile(sql, { clerkUserId: identity.clerkUserId, displayName })
    if (!completed.ok) return { kind: 'failed', error: completed.error }
    const profile = await readProfile(sql, identity.clerkUserId)
    if (profile) return { kind: 'available', profile }
  } catch {
    // Clerk and database read errors must not look like an unfinished signup.
  }
  return { kind: 'failed', error: errorResult('INTERNAL_ERROR', { messageKey: 'profile.creationFailed' }).error }
}
