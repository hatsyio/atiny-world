import type { Sql } from 'postgres'

import { currentUser } from '@clerk/nextjs/server'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { completeProfile } from '@/server/auth/profiles'
import {
  getSessionIdentity,
  type SessionIdentity,
} from '@/server/auth/session'

export const MAX_USERNAME_LENGTH = 30
export const MAX_DISPLAY_NAME_LENGTH = 50

export type CompleteProfileClientInput = {
  username: string
  displayName: string
}

export type ProfileSessionReader = () => Promise<SessionIdentity | null>

export type ClerkUserReader = () => Promise<{
  primaryEmailAddressId: string | null
  emailAddresses: Array<{ id: string; verification: { status: string } | null }>
  externalAccounts?: Array<{ provider: string }>
} | null>

function isPrimaryEmailVerified(user: NonNullable<Awaited<ReturnType<ClerkUserReader>>>): boolean {
  if (user.primaryEmailAddressId === null) return false

  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )

  return primary !== undefined && primary.verification?.status === 'verified'
}

function deriveIdentityProvider(
  user: NonNullable<Awaited<ReturnType<ClerkUserReader>>>,
): 'password' | 'google' {
  const providers = (user.externalAccounts ?? []).map((account) => account.provider)
  return providers.includes('google') ? 'google' : 'password'
}

function validateProfileInput(
  input: CompleteProfileClientInput,
): { ok: true; value: { username: string; displayName: string } } | { ok: false; fieldErrors: Record<string, string> } {
  const username = input.username.trim()
  const displayName = input.displayName.trim()
  const fieldErrors: Record<string, string> = {}

  if (username.length === 0) fieldErrors.username = 'profile.usernameRequired'
  else if (username.length > MAX_USERNAME_LENGTH) fieldErrors.username = 'profile.usernameTooLong'

  if (displayName.length === 0) fieldErrors.displayName = 'profile.displayNameRequired'
  else if (displayName.length > MAX_DISPLAY_NAME_LENGTH) fieldErrors.displayName = 'profile.displayNameTooLong'

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors }

  return { ok: true, value: { username, displayName } }
}

export async function completeProfileForSession(
  sql: Sql,
  input: CompleteProfileClientInput,
  readAuth: ProfileSessionReader = getSessionIdentity,
  readClerkUser: ClerkUserReader = currentUser,
): Promise<ActionResult<{ profilePublicId: string }>> {
  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const validated = validateProfileInput(input)
  if (!validated.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: validated.fieldErrors,
    })
  }

  const user = await readClerkUser()
  if (!user) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const completed = await completeProfile(sql, {
    clerkUserId: identity.clerkUserId,
    emailVerified: isPrimaryEmailVerified(user),
    username: validated.value.username,
    displayName: validated.value.displayName,
    identityProvider: deriveIdentityProvider(user),
  })

  if (!completed.ok) return completed

  return okResult({ profilePublicId: completed.data.publicId })
}