import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createSecondConnection, insertProfile, insertMessage, truncateProductTables } from '../support/database'
import { setSuspension, searchAccounts } from '@/server/moderation/accounts'
import { readOwnSuspensionReason } from '@/server/accounts/suspension'
import { getVisibleMessage } from '@/server/messages/public-repository'
import { pageOwnMessages } from '@/server/messages/own-message-repository'
import { updateMessage } from '@/server/messages/update-message'
import { deleteMessage } from '@/server/messages/delete-message'

const db = createTestDb()
async function clean() {
  await db`delete from app_private.moderation_actions`
  await db`delete from app_private.admin_audit`
  await db`update app_private.settings set premoderation_enabled = false, updated_by = null where id = 1`
  await truncateProductTables(db)
}
beforeEach(clean)
afterAll(async () => { await clean(); await db.end() })
async function fixture() {
  await insertProfile(db, 'admin', { role: 'admin' })
  const fan = await insertProfile(db, 'fan')
  return { fan, input: { clerkUserId: 'admin', publicId: fan.public_id, suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode: 'conduct', note: 'Private suspension note' } }
}

describe('account suspension', () => {
  it('hides all letters, preserves content/version and atomically records a private decision using runtime privileges', async () => {
    const { fan, input } = await fixture()
    const pending = await insertMessage(db, fan.id)
    const approved = await insertMessage(db, fan.id, { status: 'approved' })
    await db`set role atiny_app_runtime`
    try { expect(await setSuspension(db, input)).toMatchObject({ ok: true, data: { suspended: true, suspensionVersion: 2 } }) }
    finally { await db`reset role` }
    expect(await readOwnSuspensionReason(db, 'fan')).toBe('conduct')
    expect(await readOwnSuspensionReason(db, 'admin')).toBeNull()
    expect(await readOwnSuspensionReason(db, 'missing')).toBeNull()
    expect(await getVisibleMessage(db, pending.public_id)).toBeNull()
    expect(await getVisibleMessage(db, approved.public_id)).toBeNull()
    const own = await pageOwnMessages(db, { clerkUserId: 'fan' })
    expect(own.items).toHaveLength(2)
    expect(own.items.every(m => !m.publicVisible && m.version === 1)).toBe(true)
    expect(await updateMessage(db, { clerkUserId: 'fan', publicId: pending.public_id, expectedVersion: 1, content: 'Edited' })).toMatchObject({ ok: false, error: { code: 'ACCOUNT_SUSPENDED' } })
    const actions = await db`select action, subject_profile_id, reason_code, note from app_private.moderation_actions`
    expect(actions).toEqual([{ action: 'suspend', subject_profile_id: fan.id, reason_code: 'conduct', note: input.note }])
    const audit = await db`select action, reason_code, metadata from app_private.admin_audit`
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ action: 'suspend', reason_code: 'conduct', metadata: { previousSuspended: false, suspended: true, suspensionVersion: 2 } })
    expect(JSON.stringify(audit)).not.toContain(input.note)
    expect(await deleteMessage(db, { clerkUserId: 'fan', publicId: pending.public_id, expectedVersion: 1, confirmation: true })).toMatchObject({ ok: true })
  })
  it.each([false, true])('restores only canonically visible letters with premoderation=%s', async premoderation => {
    const { fan, input } = await fixture()
    const messages = await Promise.all(['pending', 'approved', 'rejected', 'withdrawn'].map(status => insertMessage(db, fan.id, { status, moderation_reason_code: ['rejected','withdrawn'].includes(status) ? 'spam' : null })))
    await setSuspension(db, input)
    await db`update app_private.settings set premoderation_enabled = ${premoderation} where id = 1`
    expect(await setSuspension(db, { ...input, suspended: false, expectedSuspensionVersion: 2 })).toMatchObject({ ok: true, data: { suspensionVersion: 3 } })
    for (let i = 0; i < messages.length; i++) expect((await getVisibleMessage(db, messages[i].public_id)) !== null).toBe(i === 1 || (i === 0 && !premoderation))
    expect(await db`select suspended_at, suspension_reason_code, suspension_note, suspended_by from app_private.profiles where id = ${fan.id}`).toEqual([{ suspended_at: null, suspension_reason_code: null, suspension_note: null, suspended_by: null }])
    expect((await db`select action from app_private.moderation_actions order by id`).map(r => r.action)).toEqual(['suspend', 'reinstate'])
  })
  it('denies fans, suspended/revoked actors, owner targets, self and deletion-pending targets', async () => {
    const { input } = await fixture()
    await insertProfile(db, 'owner', { role: 'owner' })
    const result = await searchAccounts(db, 'owner', '')
    if (!result.ok) throw new Error('Owner search failed')
    const owner = result.data
    const ownerId = owner.items.find(a => a.role === 'owner')!.publicId
    expect(await setSuspension(db, { ...input, clerkUserId: 'fan' })).toMatchObject({ ok: false })
    expect(await setSuspension(db, { ...input, clerkUserId: 'owner', publicId: ownerId })).toMatchObject({ ok: false })
    expect(await setSuspension(db, { ...input, publicId: ownerId })).toMatchObject({ ok: false })
    await db`update app_private.profiles set suspended_at = now(), suspension_reason_code = 'spam' where clerk_user_id = 'admin'`
    expect(await setSuspension(db, input)).toMatchObject({ ok: false })
    await db`update app_private.profiles set suspended_at = null, role = 'fan' where clerk_user_id = 'admin'`
    expect(await setSuspension(db, input)).toMatchObject({ ok: false })
    await db`update app_private.profiles set account_state = 'deletion_pending' where clerk_user_id = 'fan'`
    expect(await setSuspension(db, { ...input, clerkUserId: 'owner' })).toMatchObject({ ok: false })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('allows only the owner to suspend and reinstate an administrator', async () => {
    const { input } = await fixture()
    await insertProfile(db, 'owner', { role: 'owner' })
    const target = await insertProfile(db, 'second-admin', { role: 'admin' })
    const request = { ...input, publicId: target.public_id, expectedRoleVersion: 2 }
    expect(await setSuspension(db, request)).toMatchObject({ ok: false })
    expect(await setSuspension(db, { ...request, clerkUserId: 'owner' })).toMatchObject({ ok: true })
    expect(await searchAccounts(db, 'second-admin', '')).toMatchObject({ ok: false })
    expect(await setSuspension(db, { ...request, suspended: false, expectedSuspensionVersion: 2 })).toMatchObject({ ok: false })
    expect(await setSuspension(db, { ...request, clerkUserId: 'owner', suspended: false, expectedSuspensionVersion: 2 })).toMatchObject({ ok: true })
  })
  it('rejects unknown reasons, long notes, malformed booleans and invalid versions without writes', async () => {
    const { input } = await fixture()
    for (const patch of [{ reasonCode: '' }, { reasonCode: 'unknown' }, { note: 'x'.repeat(1001) }, { suspended: 'true' }, { expectedSuspensionVersion: 0 }, { expectedRoleVersion: NaN }]) {
      expect(await setSuspension(db, { ...input, ...patch } as typeof input)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    }
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('rejects role changes and suspension ABA with old forms; no-op never creates audit', async () => {
    const { input } = await fixture()
    expect(await setSuspension(db, { ...input, suspended: false })).toMatchObject({ ok: true })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
    await setSuspension(db, input)
    await setSuspension(db, { ...input, suspended: false, expectedSuspensionVersion: 2 })
    expect(await setSuspension(db, input)).toMatchObject({ ok: false, error: { messageKey: 'admin.suspension.conflict' } })
    await db`update app_private.profiles set role = 'admin' where public_id = ${input.publicId}`
    expect(await setSuspension(db, { ...input, expectedSuspensionVersion: 3 })).toMatchObject({ ok: false })
  })
  it('serializes simultaneous suspensions and audits exactly once', async () => {
    const { input } = await fixture()
    const other = createSecondConnection()
    try {
      const results = await Promise.all([setSuspension(db, input), setSuspension(other, input)])
      expect(results.filter(r => r.ok)).toHaveLength(1)
      expect(results.find(r => !r.ok)).toMatchObject({ error: { messageKey: 'admin.suspension.conflict' } })
      expect(await db`select * from app_private.admin_audit`).toHaveLength(1)
    } finally { await other.end() }
  })
  it('waits for an in-flight permission revocation and denies the actor after commit', async () => {
    const { input } = await fixture()
    const other = createSecondConnection()
    let finished = false
    let attempt: ReturnType<typeof setSuspension> | undefined
    try {
      await other.begin(async tx => {
        await tx`update app_private.profiles set role = 'fan' where clerk_user_id = 'admin'`
        attempt = setSuspension(db, input).then(result => { finished = true; return result })
        await new Promise(resolve => setTimeout(resolve, 25))
        expect(finished).toBe(false)
      })
      expect(await attempt).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
    } finally { await other.end() }
  })
  it('waits for settings impact to finish before changing account visibility', async () => {
    const { input } = await fixture()
    const other = createSecondConnection()
    let finished = false
    let attempt: ReturnType<typeof setSuspension> | undefined
    try {
      await other.begin(async tx => {
        await tx`select id from app_private.settings where id = 1 for update`
        attempt = setSuspension(db, input).then(result => { finished = true; return result })
        await new Promise(resolve => setTimeout(resolve, 25))
        expect(finished).toBe(false)
        expect(await tx`select suspended_at from app_private.profiles where public_id = ${input.publicId}`).toEqual([{ suspended_at: null }])
      })
      expect(await attempt).toMatchObject({ ok: true })
    } finally { await other.end() }
  })
  it('does not let a direct version rewrite invalidate or revive forms', async () => {
    const { input } = await fixture()
    await db`update app_private.profiles set suspension_version = 99 where public_id = ${input.publicId}`
    expect(await db`select suspension_version from app_private.profiles where public_id = ${input.publicId}`).toEqual([{ suspension_version: 1 }])
    expect(await setSuspension(db, input)).toMatchObject({ ok: true, data: { suspensionVersion: 2 } })
  })
  it('rolls back the account and decision if audit insertion fails', async () => {
    const { input } = await fixture()
    await db`alter table app_private.admin_audit add constraint test_suspend_audit check (action <> 'suspend')`
    try {
      await expect(setSuspension(db, input)).rejects.toThrow()
      expect(await db`select suspended_at, suspension_version from app_private.profiles where public_id = ${input.publicId}`).toEqual([{ suspended_at: null, suspension_version: 1 }])
      expect(await db`select * from app_private.moderation_actions`).toHaveLength(0)
    } finally { await db`alter table app_private.admin_audit drop constraint test_suspend_audit` }
  })
})
