import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createSecondConnection, insertProfile, truncateProductTables } from '../support/database'
import { setAdministratorRole, searchAccounts } from '@/server/moderation/accounts'
import { bootstrapOwner } from '@/server/moderation/bootstrap-owner'

const db = createTestDb()
beforeEach(async () => { await db`delete from app_private.admin_audit`; await truncateProductTables(db) })
afterAll(async () => { await db`delete from app_private.admin_audit`; await truncateProductTables(db); await db.end() })

describe('administration roles', () => {
  it('changes roles and writes audit using the least-privileged runtime role', async () => {
    await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    await db`set role atiny_app_runtime`
    try {
      expect(await setAdministratorRole(db, { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })).toMatchObject({ ok: true })
    } finally { await db`reset role` }
  })
  it('keeps audit append-only for runtime and inaccessible to preview', async () => {
    const rows = await db`select
      has_table_privilege('atiny_app_runtime', 'app_private.admin_audit', 'SELECT') as runtime_read,
      has_table_privilege('atiny_app_runtime', 'app_private.admin_audit', 'INSERT') as runtime_insert,
      has_table_privilege('atiny_app_runtime', 'app_private.admin_audit', 'UPDATE') as runtime_update,
      has_table_privilege('atiny_app_runtime', 'app_private.admin_audit', 'DELETE') as runtime_delete,
      has_table_privilege('atiny_preview_reader', 'app_private.admin_audit', 'SELECT') as preview_read`
    expect(rows[0]).toEqual({ runtime_read: true, runtime_insert: true, runtime_update: false, runtime_delete: false, preview_read: false })
  })
  it('serializes simultaneous role changes and rejects the stale one', async () => {
    await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    const other = createSecondConnection()
    const input = { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 }
    try {
      const results = await Promise.all([setAdministratorRole(db, input), setAdministratorRole(other, input)])
      expect(results.filter(result => result.ok)).toHaveLength(1)
      expect(results.find(result => !result.ok)).toMatchObject({ ok: false, error: { messageKey: 'admin.conflict' } })
      expect(await db`select * from app_private.admin_audit`).toHaveLength(1)
    } finally { await other.end() }
  })
  it('bootstraps the exact owner idempotently and prevents replacing an existing owner', async () => {
    expect(await bootstrapOwner(db, { clerkUserId: 'user_owner', displayName: 'Josep' })).toMatchObject({ role: 'owner' })
    expect(await bootstrapOwner(db, { clerkUserId: 'user_owner', displayName: 'Changed' })).toMatchObject({ role: 'owner' })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(1)
    await expect(bootstrapOwner(db, { clerkUserId: 'user_other', displayName: 'Other' })).rejects.toThrow('already exists')
    const rows = await db`select display_name from app_private.profiles where clerk_user_id = 'user_owner'`
    expect(rows[0].display_name).toBe('Josep')
  })
  it('allows both independently verified identities of the owner in a shared database', async () => {
    await bootstrapOwner(db, { clerkUserId: 'user_live', displayName: 'Production' })
    await bootstrapOwner(db, { clerkUserId: 'user_test', displayName: 'Development', verifiedOtherInstanceUserId: 'user_live' })
    const rows = await db`select role from app_private.profiles order by id`
    expect(rows.map(row => row.role)).toEqual(['owner', 'owner'])
    await expect(bootstrapOwner(db, { clerkUserId: 'user_stranger', displayName: 'Stranger', verifiedOtherInstanceUserId: 'user_live' })).rejects.toThrow('already exists')
  })
  it('allows only an active owner to assign and remove administrators, with audit', async () => {
    const owner = await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    expect(await setAdministratorRole(db, { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })).toMatchObject({ ok: true })
    expect(await setAdministratorRole(db, { clerkUserId: 'owner', publicId: fan.public_id, role: 'fan', expectedRole: 'admin', expectedRoleVersion: 2 })).toMatchObject({ ok: true })
    const rows = await db`select actor_id, action, metadata from app_private.admin_audit order by id`
    expect(rows).toHaveLength(2)
    expect(String(rows[0].actor_id)).toBe(String(owner.id))
    expect(rows[0].metadata).toEqual({ previousRole: 'fan', role: 'admin' })
  })
  it('rejects fans, administrators, suspended owners and deleted owners', async () => {
    const target = await insertProfile(db, 'target')
    await insertProfile(db, 'fan')
    await insertProfile(db, 'admin', { role: 'admin' })
    await insertProfile(db, 'suspended', { role: 'owner', suspended_at: new Date().toISOString(), suspension_reason_code: 'spam' })
    await insertProfile(db, 'deleted', { role: 'owner', account_state: 'deletion_pending' })
    for (const clerkUserId of ['missing', 'fan', 'admin', 'suspended', 'deleted']) {
      expect(await setAdministratorRole(db, { clerkUserId, publicId: target.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })).toMatchObject({ ok: false })
    }
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('protects owners and rejects forged roles, stale forms and unavailable targets', async () => {
    const owner = await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    const deleted = await insertProfile(db, 'deleted', { account_state: 'deletion_pending' })
    for (const input of [
      { publicId: owner.public_id, role: 'fan', expectedRole: 'owner' },
      { publicId: fan.public_id, role: 'owner', expectedRole: 'fan', expectedRoleVersion: 1 },
      { publicId: fan.public_id, role: 'admin', expectedRole: 'admin', expectedRoleVersion: 2 },
      { publicId: deleted.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 },
      { publicId: 'invalid', role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 },
    ]) expect(await setAdministratorRole(db, { clerkUserId: 'owner', expectedRoleVersion: 1, ...input })).toMatchObject({ ok: false })
  })
  it('rechecks a revoked owner on the next operation', async () => {
    await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    await db`update app_private.profiles set role = 'fan' where clerk_user_id = 'owner'`
    expect(await setAdministratorRole(db, { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })).toMatchObject({ ok: false })
    expect(await searchAccounts(db, 'owner', '')).toMatchObject({ ok: false })
  })
  it('rejects an old form after a grant and revocation restore the original role', async () => {
    await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    const input = { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 }
    expect(await setAdministratorRole(db, input)).toMatchObject({ ok: true })
    expect(await setAdministratorRole(db, { ...input, role: 'fan', expectedRole: 'admin', expectedRoleVersion: 2 })).toMatchObject({ ok: true })
    expect(await setAdministratorRole(db, input)).toMatchObject({ ok: false, error: { messageKey: 'admin.conflict' } })
  })
  it('does not disclose accounts to fans, and searches names literally', async () => {
    await insertProfile(db, 'admin', { role: 'admin' })
    await insertProfile(db, 'fan', { display_name: 'Special % name' })
    await insertProfile(db, 'other', { display_name: 'Another name' })
    expect(await searchAccounts(db, 'fan', '')).toMatchObject({ ok: false })
    const result = await searchAccounts(db, 'admin', '%')
    expect(result.ok && result.data.items.map(item => item.displayName)).toEqual(['Special % name'])
    if (result.ok) expect(result.data.items[0]).not.toHaveProperty('clerk_user_id')
  })
  it('rolls back a role change when the audit write fails', async () => {
    await insertProfile(db, 'owner', { role: 'owner' })
    const fan = await insertProfile(db, 'fan')
    await db`alter table app_private.admin_audit add constraint test_reject_audit check (action <> 'set_administrator_role')`
    try {
      await expect(setAdministratorRole(db, { clerkUserId: 'owner', publicId: fan.public_id, role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })).rejects.toThrow()
      const rows = await db`select role from app_private.profiles where public_id = ${fan.public_id}`
      expect(rows[0].role).toBe('fan')
    } finally { await db`alter table app_private.admin_audit drop constraint test_reject_audit` }
  })
})
