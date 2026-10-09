import type { Sql } from '@/server/db/sql'
import { currentUser } from '@clerk/nextjs/server'
import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { recoverProfile, type ClerkUserReader, type ProfileSessionReader } from '@/server/auth/profile-recovery'
import { getSessionIdentity } from '@/server/auth/session'

export async function completeProfileForSession(
  sql: Sql,
  readAuth: ProfileSessionReader = getSessionIdentity,
  readClerkUser: ClerkUserReader = currentUser,
): Promise<ActionResult<{ profilePublicId: string }>> {
  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })
  const result = await recoverProfile(sql, identity, readClerkUser)
  return result.kind === 'available'
    ? okResult({ profilePublicId: result.profile.public_id })
    : { ok: false, error: result.error }
}
