import type { Sql } from 'postgres'

import {
  errorResult,
  okResult,
  type ActionResult,
  type ProfileRole,
  isProfileRole,
} from '@/domain/contracts'

import {
  getSessionIdentity,
  readProfileByClerkUserId,
  type ClerkAuthReader,
  type ProfileReader,
  type SessionProfileRow,
  type SessionIdentity,
} from './session'
import { auth } from '@clerk/nextjs/server'

export type AuthorizedProfile = {
  profileId: string
  publicId: string
  displayName: string
  role: ProfileRole
}

export type ProfileResolutionError =
  | 'PROFILE_INCOMPLETE'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETION_PENDING'

export type AuthorizeProfileError = {
  kind: ProfileResolutionError
}

export function isProfileComplete(row: SessionProfileRow): boolean {
  return row.display_name.trim().length > 0
}

export function resolveProfileState(
  row: SessionProfileRow | null,
): { ok: true; profile: AuthorizedProfile } | { ok: false; error: AuthorizeProfileError } {
  if (!row || !isProfileComplete(row)) {
    return { ok: false, error: { kind: 'PROFILE_INCOMPLETE' } }
  }
  if (row.account_state === 'deletion_pending') {
    return { ok: false, error: { kind: 'ACCOUNT_DELETION_PENDING' } }
  }
  if (row.suspended_at !== null) {
    return { ok: false, error: { kind: 'ACCOUNT_SUSPENDED' } }
  }
  if (!isProfileRole(row.role)) {
    return { ok: false, error: { kind: 'PROFILE_INCOMPLETE' } }
  }

  return {
    ok: true,
    profile: {
      profileId: row.id,
      publicId: row.public_id,
      displayName: row.display_name,
      role: row.role,
    },
  }
}

export function toAuthorizeActionResult<T>(
  result:
    | { ok: true; profile: T }
    | { ok: false; error: AuthorizeProfileError },
): ActionResult<T> {
  if (result.ok) return okResult(result.profile)

  switch (result.error.kind) {
    case 'ACCOUNT_SUSPENDED':
      return errorResult('ACCOUNT_SUSPENDED', { messageKey: 'account.suspended' })
    case 'ACCOUNT_DELETION_PENDING':
      return errorResult('ACCOUNT_SUSPENDED', { messageKey: 'account.deletionPending' })
    case 'PROFILE_INCOMPLETE':
      return errorResult('PROFILE_INCOMPLETE', { messageKey: 'profile.incomplete' })
  }
}

export async function authorizeSession(
  sql: Sql,
  readAuth: ClerkAuthReader = auth,
  readProfile: ProfileReader = readProfileByClerkUserId,
): Promise<ActionResult<AuthorizedProfile>> {
  const identity = await getSessionIdentity(readAuth)

  return identity ? authorizeProfile(sql, identity, readProfile) : notAuthenticated()
}

export async function authorizeProfile(
  sql: Sql,
  identity: SessionIdentity,
  readProfile: ProfileReader = readProfileByClerkUserId,
): Promise<ActionResult<AuthorizedProfile>> {
  const row = await readProfile(sql, identity.clerkUserId)

  return toAuthorizeActionResult(resolveProfileState(row))
}

export async function requireRole(
  profile: AuthorizedProfile,
  allowedRoles: readonly ProfileRole[],
): Promise<ActionResult<AuthorizedProfile>> {
  if (allowedRoles.includes(profile.role)) return okResult(profile)
  return errorResult('NOT_FOUND', { messageKey: 'auth.roleRequired' })
}

function notAuthenticated(): ActionResult<never> {
  return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })
}
