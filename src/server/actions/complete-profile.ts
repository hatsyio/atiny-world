import type { Sql } from 'postgres'

import { currentUser } from '@clerk/nextjs/server'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { completeProfile } from '@/server/auth/profiles'
import { getSessionIdentity, type SessionIdentity } from '@/server/auth/session'

export const MAX_DISPLAY_NAME_LENGTH = 50
export type ProfileSessionReader = () => Promise<SessionIdentity | null>
export type ClerkUserReader = () => Promise<{
  id: string
  primaryEmailAddressId: string | null
  emailAddresses: Array<{ id: string; verification: { status: string } | null }>
  externalAccounts?: Array<{ provider: string }>
  unsafeMetadata: Record<string, unknown>
} | null>

function isIdentityVerified(user: NonNullable<Awaited<ReturnType<ClerkUserReader>>>): boolean {
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
  return primary?.verification?.status === 'verified' ||
    (user.externalAccounts ?? []).some((account) => account.provider === 'google')
}

export function validatePublicName(value: unknown): string | null {
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

  const displayName = validatePublicName(user.unsafeMetadata.publicName)
  if (!displayName) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { publicName: 'profile.publicNameRequired' },
    })
  }

  const completed = await completeProfile(sql, {
    clerkUserId: identity.clerkUserId,
    emailVerified: isIdentityVerified(user),
    displayName,
  })
  return completed.ok ? okResult({ profilePublicId: completed.data.publicId }) : completed
}
