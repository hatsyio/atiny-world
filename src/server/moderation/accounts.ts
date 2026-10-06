import type { Sql } from 'postgres'
import { errorResult, okResult, parsePublicId, isProfileRole, type ActionResult, type ProfileRole } from '@/domain/contracts'

type AccountRow = {
  id: string
  public_id: string
  display_name: string
  role: ProfileRole
  role_version: number
  account_state: string
  suspended_at: string | null
}

export type AdminAccount = {
  publicId: string
  displayName: string
  role: ProfileRole
  roleVersion: number
  state: 'active' | 'suspended' | 'deletion_pending'
}

function active(row: AccountRow | undefined): row is AccountRow {
  return !!row && !!row.display_name.trim() && row.account_state === 'active' && row.suspended_at === null
}

const denied = () => errorResult('NOT_FOUND', { messageKey: 'admin.denied' })

export async function searchAccounts(sql: Sql, clerkUserId: string, query: string, page = 1): Promise<ActionResult<{ items: AdminAccount[]; hasMore: boolean; actorRole: 'admin' | 'owner' }>> {
  if (query.length > 100 || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    return errorResult('VALIDATION_ERROR', { messageKey: 'admin.invalid' })
  }
  return sql.begin(async tx => {
    // Hold authorization until the read completes, so revocation cannot race it.
    const actors = await tx<AccountRow[]>`
      select id, public_id, display_name, role, role_version, account_state, suspended_at
      from app_private.profiles where clerk_user_id = ${clerkUserId} for share
    `
    const actor = actors[0]
    if (!active(actor) || (actor.role !== 'admin' && actor.role !== 'owner')) return denied()
    const term = query.trim()
    // strpos treats SQL wildcard characters as literal search text.
    const rows = await tx<AccountRow[]>`
      select id, public_id, display_name, role, role_version, account_state, suspended_at
      from app_private.profiles
      where strpos(lower(display_name), lower(${term})) > 0
         or strpos(lower(clerk_user_id), lower(${term})) > 0
      order by display_name, id limit 26 offset ${(page - 1) * 25}
    `
    return okResult({
      actorRole: actor.role,
      items: rows.slice(0, 25).map(row => ({ publicId: row.public_id, displayName: row.display_name, role: row.role, roleVersion: row.role_version,
        state: row.account_state === 'deletion_pending' ? 'deletion_pending' : row.suspended_at ? 'suspended' : 'active' })),
      hasMore: rows.length > 25,
    })
  })
}

export async function setAdministratorRole(sql: Sql, input: {
  clerkUserId: string; publicId: string; role: string; expectedRole: string; expectedRoleVersion: number
}): Promise<ActionResult<{ publicId: string; role: 'fan' | 'admin' }>> {
  const targetId = parsePublicId(input.publicId)
  if (!targetId.ok || (input.role !== 'fan' && input.role !== 'admin') || !isProfileRole(input.expectedRole) || !Number.isSafeInteger(input.expectedRoleVersion) || input.expectedRoleVersion < 1) {
    return errorResult('VALIDATION_ERROR', { messageKey: 'admin.invalid' })
  }
  const role = input.role
  return sql.begin(async tx => {
    // Lock both profiles in stable order to avoid deadlocks between role changes.
    const rows = await tx<(AccountRow & { clerk_user_id: string })[]>`
      select id, public_id, clerk_user_id, display_name, role, role_version, account_state, suspended_at
      from app_private.profiles
      where clerk_user_id = ${input.clerkUserId} or public_id = ${targetId.value}
      order by id for update
    `
    const actor = rows.find(row => row.clerk_user_id === input.clerkUserId)
    if (!active(actor) || actor.role !== 'owner') return denied()
    const target = rows.find(row => row.public_id === targetId.value)
    if (!target || target.role === 'owner' || target.account_state !== 'active' || !target.display_name.trim()) return denied()
    if (target.role !== input.expectedRole || target.role_version !== input.expectedRoleVersion) return errorResult('VALIDATION_ERROR', { messageKey: 'admin.conflict' })
    if (target.role === role) return okResult({ publicId: target.public_id, role })
    await tx`update app_private.profiles set role = ${role}, updated_at = now() where id = ${target.id}`
    await tx`
      insert into app_private.admin_audit (actor_id, action, target_type, target_public_id, metadata)
      values (${actor.id}, 'set_administrator_role', 'profile', ${target.public_id},
        ${tx.json({ previousRole: target.role, role })})
    `
    return okResult({ publicId: target.public_id, role })
  })
}
