import type { Sql } from 'postgres'

import { auth } from '@clerk/nextjs/server'

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
  lang: string,
): string | null {
  switch (gate.kind) {
    case 'anonymous':
      return `/${lang}/sign-in`
    case 'incomplete':
      return `/${lang}/profile`
    default:
      return null
  }
}

export async function resolveAccountGate(
  sql: Sql,
  readAuth: ClerkAuthReader = auth,
  readProfile: ProfileReader = readProfileByClerkUserId,
): Promise<AccountGate> {
  const identity = await getSessionIdentity(readAuth)

  if (!identity) return { kind: 'anonymous' }

  const row = await readProfile(sql, identity.clerkUserId)
  const resolved = resolveProfileState(row)

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