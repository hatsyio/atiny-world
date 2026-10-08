import type { Sql } from 'postgres'
import { authRoute } from './auth-destination'

import { auth } from '@clerk/nextjs/server'
import { currentUser } from '@clerk/nextjs/server'
import { recoverProfile, type ClerkUserReader } from './profile-recovery'

import {
  getSessionIdentity,
  readProfileByClerkUserId,
  type ClerkAuthReader,
  type ProfileReader,
} from './session'
import { resolveProfileState, type AuthorizedProfile } from './authorize'

export type AccountGate =
  | { kind: 'anonymous' }
  | { kind: 'incomplete' }
  | { kind: 'suspended' }
  | { kind: 'deletion-pending' }
  | { kind: 'allowed'; profile: AuthorizedProfile }

export function writeLetterRedirect(
  gate: AccountGate,
  lang: 'en' | 'es',
  next: string = '/messages/new',
): string | null {
  switch (gate.kind) {
    case 'anonymous':
      return authRoute(lang, 'sign-in', next)
    case 'incomplete':
      return authRoute(lang, 'profile', next)
    default:
      return null
  }
}

export async function resolveAccountGate(
  sql: Sql,
  readAuth: ClerkAuthReader = auth,
  readProfile: ProfileReader = readProfileByClerkUserId,
  readClerkUser: ClerkUserReader = currentUser,
): Promise<AccountGate> {
  const identity = await getSessionIdentity(readAuth)

  if (!identity) return { kind: 'anonymous' }

  const recovery = await recoverProfile(sql, identity, readClerkUser, readProfile)
  if (recovery.kind === 'failed') throw new Error(recovery.error.messageKey)
  if (recovery.kind === 'incomplete') return { kind: 'incomplete' }
  const resolved = resolveProfileState(recovery.profile)

  if (!resolved.ok) {
    switch (resolved.error.kind) {
      case 'PROFILE_INCOMPLETE':
        return { kind: 'incomplete' }
      case 'ACCOUNT_SUSPENDED':
        return { kind: 'suspended' }
      case 'ACCOUNT_DELETION_PENDING':
        return { kind: 'deletion-pending' }
    }
  }

  return { kind: 'allowed', profile: resolved.profile }
}
