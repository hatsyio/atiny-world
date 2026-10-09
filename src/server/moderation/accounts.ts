import type { Sql } from '@/server/db/sql'
import { errorResult, okResult, parsePublicId, isProfileRole, type ActionResult, type ProfileRole } from '@/domain/contracts'

import { canSetSuspension, validateSuspension } from '@/domain/moderation/policies'

type AccountRow = {
  id: string
  public_id: string
  display_name: string
  role: ProfileRole
  role_version: number
  suspension_version: number
  account_state: string
  suspended_at: string | null
}

export type AdminAccount = {
  publicId: string
  displayName: string
  role: ProfileRole
  roleVersion: number
  suspensionVersion: number
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
      select id, public_id, display_name, role, role_version, suspension_version, account_state, suspended_at
      from app_private.profiles where clerk_user_id = ${clerkUserId} for share
    `
    const actor = actors[0]
    if (!active(actor) || (actor.role !== 'admin' && actor.role !== 'owner')) return denied()
    const term = query.trim()
    // strpos treats SQL wildcard characters as literal search text.
    const rows = await tx<AccountRow[]>`
      select id, public_id, display_name, role, role_version, suspension_version, account_state, suspended_at
      from app_private.profiles
      where strpos(lower(display_name), lower(${term})) > 0
         or strpos(lower(clerk_user_id), lower(${term})) > 0
      order by display_name, id limit 26 offset ${(page - 1) * 25}
    `
    return okResult({
      actorRole: actor.role,
      items: rows.slice(0, 25).map(row => ({ publicId: row.public_id, displayName: row.display_name, role: row.role, roleVersion: row.role_version, suspensionVersion: row.suspension_version,
        state: row.account_state === 'deletion_pending' ? 'deletion_pending' : row.suspended_at ? 'suspended' : 'active' })),
      hasMore: rows.length > 25,
    })
  })
}

export type SetAdministratorRoleResult =
  | { ok: true; data: { publicId: string; role: 'fan' | 'admin' } }
  | { ok: false; error: { code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'ROLE_VERSION_CONFLICT' } }

export async function setAdministratorRole(sql: Sql, input: {
  clerkUserId: string; publicId: string; role: string; expectedRole: string; expectedRoleVersion: number
}): Promise<SetAdministratorRoleResult> {
  const targetId = parsePublicId(input.publicId)
  if (!targetId.ok || (input.role !== 'fan' && input.role !== 'admin') || !isProfileRole(input.expectedRole) || !Number.isSafeInteger(input.expectedRoleVersion) || input.expectedRoleVersion < 1) {
    return { ok: false, error: { code: 'VALIDATION_ERROR' } }
  }
  const role = input.role
  return sql.begin(async tx => {
    // Lock both profiles in stable order to avoid deadlocks between role changes.
    const rows = await tx<(AccountRow & { clerk_user_id: string })[]>`
      select id, public_id, clerk_user_id, display_name, role, role_version, suspension_version, account_state, suspended_at
      from app_private.profiles
      where clerk_user_id = ${input.clerkUserId} or public_id = ${targetId.value}
      order by id for update
    `
    const actor = rows.find(row => row.clerk_user_id === input.clerkUserId)
    if (!active(actor) || (actor.role !== 'admin' && actor.role !== 'owner')) return { ok: false, error: { code: 'NOT_FOUND' } }
    const target = rows.find(row => row.public_id === targetId.value)
    if (!target || target.id === actor.id || target.role === 'owner' || target.account_state !== 'active' || !target.display_name.trim()) return { ok: false, error: { code: 'NOT_FOUND' } }
    if (target.role !== input.expectedRole || target.role_version !== input.expectedRoleVersion) return { ok: false, error: { code: 'ROLE_VERSION_CONFLICT' } }
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

export type SetSuspensionInput = {
  clerkUserId: string; publicId: string; suspended: boolean
  expectedRoleVersion: number; expectedSuspensionVersion: number; reasonCode?: string; note?: string
}
export type SetSuspensionSuccess = { publicId: string; suspended: boolean; suspensionVersion: number }

export async function setSuspension(sql: Sql, input: SetSuspensionInput): Promise<ActionResult<SetSuspensionSuccess>> {
  const publicId = parsePublicId(input.publicId)
  const validated = validateSuspension(input)
  const validVersion = (value: number) => Number.isSafeInteger(value) && value > 0 && value < 2147483647
  if (!publicId.ok || !validated.ok || !validVersion(input.expectedRoleVersion) || !validVersion(input.expectedSuspensionVersion)) {
    return errorResult('VALIDATION_ERROR', { messageKey: 'admin.suspension.invalid' })
  }
  const { suspended, reasonCode, note } = validated.data
  return sql.begin(async tx => {
    // Match role changes and message operations: lock profiles in ID order first.
    const rows = await tx<(AccountRow & { clerk_user_id: string })[]>`
      select id, public_id, clerk_user_id, display_name, role, role_version, suspension_version, account_state, suspended_at
      from app_private.profiles
      where clerk_user_id = ${input.clerkUserId} or public_id = ${publicId.value}
      order by id for update
    `
    const actor = rows.find(row => row.clerk_user_id === input.clerkUserId)
    const target = rows.find(row => row.public_id === publicId.value)
    if (!actor || !target || actor.id === target.id || !canSetSuspension(
      { role: actor.role, accountState: actor.account_state, suspendedAt: actor.suspended_at, displayName: actor.display_name },
      { role: target.role, accountState: target.account_state, displayName: target.display_name },
    )) return errorResult('NOT_FOUND', { messageKey: 'admin.suspension.denied' })
    if (target.role_version !== input.expectedRoleVersion || target.suspension_version !== input.expectedSuspensionVersion) {
      return errorResult('MESSAGE_VERSION_CONFLICT', { messageKey: 'admin.suspension.conflict' })
    }
    const previousSuspended = target.suspended_at !== null
    if (previousSuspended === suspended) return okResult({ publicId: target.public_id, suspended, suspensionVersion: target.suspension_version })
    // Visibility changes synchronize with the settings impact transaction.
    await tx`select id from app_private.settings where id = 1 for share`
    const updated = await tx<{ suspension_version: number }[]>`
      update app_private.profiles set suspended_at = case when ${suspended} then now() else null end,
        suspension_reason_code = ${reasonCode}, suspension_note = ${note},
        suspended_by = ${suspended ? actor.id : null}, updated_at = now()
      where id = ${target.id} returning suspension_version
    `
    const action = suspended ? 'suspend' : 'reinstate'
    const suspensionVersion = updated[0].suspension_version
    await tx`
      insert into app_private.moderation_actions (actor_id, action, subject_profile_id, reason_code, note)
      values (${actor.id}, ${action}, ${target.id}, ${reasonCode}, ${note})
    `
    await tx`
      insert into app_private.admin_audit (actor_id, action, target_type, target_public_id, reason_code, metadata)
      values (${actor.id}, ${action}, 'profile', ${target.public_id}, ${reasonCode},
        ${tx.json({ previousSuspended, suspended, suspensionVersion })})
    `
    return okResult({ publicId: target.public_id, suspended, suspensionVersion })
  })
}
