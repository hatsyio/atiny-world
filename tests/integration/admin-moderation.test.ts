import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createSecondConnection, insertProfile, insertMessage, truncateProductTables } from '../support/database'
import { moderateMessage } from '@/server/moderation/moderate-message'
import { searchModerationMessages } from '@/server/moderation/message-repository'
import { updateMessage } from '@/server/messages/update-message'
import { getVisibleMessage, listFeaturesInViewport, listLatestPublicMessages } from '@/server/messages/public-repository'
import { pageOwnMessages } from '@/server/messages/own-message-repository'

const db = createTestDb()
async function clean() {
  await db`delete from app_private.moderation_actions`
  await db`delete from app_private.admin_audit`
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false where id = 1`
}
beforeEach(clean)
afterAll(async () => { await clean(); await db.end() })
async function fixture(status = 'pending') {
  const actor = await insertProfile(db, 'admin', { role: 'admin' })
  const author = await insertProfile(db, 'author')
  const message = await insertMessage(db, author.id, { status, content: 'Original letter', moderation_reason_code: status === 'rejected' || status === 'withdrawn' ? 'spam' : null })
  return { actor, author, message }
}
const decide = (publicId: string, decision: string, extra = {}) => moderateMessage(db, { clerkUserId: 'admin', publicId, expectedVersion: 1, decision, ...extra })

describe('message moderation', () => {
  it('approves the reviewed version with runtime privileges, without rewriting content, point or publication date', async () => {
    const { actor, message } = await fixture()
    const before = await db`select content, public_point::text, published_at from app_private.messages where id = ${message.id}`
    await db`set role atiny_app_runtime`
    try { expect(await decide(message.public_id, 'approve')).toEqual({ ok: true, data: { publicId: message.public_id, status: 'approved', version: 2 } }) }
    finally { await db`reset role` }
    expect(await db`select content, public_point::text, published_at from app_private.messages where id = ${message.id}`).toEqual(before)
    const actions = await db`select actor_id, message_version, action from app_private.moderation_actions`
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actor_id: actor.id, message_version: 1, action: 'approve' })
    expect(await db`select metadata from app_private.admin_audit`).toMatchObject([{ metadata: { previousStatus: 'pending', status: 'approved', messageVersion: 1, resultingVersion: 2 } }])
  })
  it.each(['reject', 'withdraw'])('hides a letter after %s and exposes its reason only to the author', async decision => {
    const { message } = await fixture(decision === 'withdraw' ? 'approved' : 'pending')
    expect(await decide(message.public_id, decision, { reasonCode: 'privacy', note: 'Private note' })).toMatchObject({ ok: true })
    expect(await getVisibleMessage(db, message.public_id)).toBeNull()
    expect(await listFeaturesInViewport(db, { west: -10, south: 30, east: 10, north: 50 })).toHaveLength(0)
    expect(await listLatestPublicMessages(db)).toHaveLength(0)
    const own = await pageOwnMessages(db, { clerkUserId: 'author' })
    expect(own.items[0]).toMatchObject({ status: decision === 'reject' ? 'rejected' : 'withdrawn', moderationReasonCode: 'privacy', moderationNote: 'Private note', publicVisible: false })
    const audit = await db`select reason_code, metadata from app_private.admin_audit`
    expect(audit[0].reason_code).toBe('privacy')
    expect(JSON.stringify(audit)).not.toContain('Private note')
    expect(JSON.stringify(audit)).not.toContain('Original letter')
  })
  it('makes an approved pending letter public with premoderation enabled', async () => {
    const { message } = await fixture()
    await db`update app_private.settings set premoderation_enabled = true where id = 1`
    expect(await getVisibleMessage(db, message.public_id)).toBeNull()
    expect(await decide(message.public_id, 'approve')).toMatchObject({ ok: true })
    const visible = await getVisibleMessage(db, message.public_id)
    expect(visible?.content).toBe('Original letter')
    expect(visible).not.toHaveProperty('moderationReasonCode')
  })
  it('withdraws a public pending letter but not a hidden pending letter', async () => {
    const { message } = await fixture()
    await db`update app_private.settings set premoderation_enabled = true where id = 1`
    expect(await decide(message.public_id, 'withdraw', { reasonCode: 'spam' })).toMatchObject({ ok: false })
    await db`update app_private.settings set premoderation_enabled = false where id = 1`
    expect(await decide(message.public_id, 'withdraw', { reasonCode: 'spam' })).toMatchObject({ ok: true })
  })
  it('rejects missing/unknown reasons, invalid IDs/versions and disallowed transitions without audit', async () => {
    const { message } = await fixture('approved')
    for (const extra of [
      { decision: 'approve' }, { decision: 'reject', reasonCode: 'spam' }, { decision: 'withdraw' },
      { decision: 'withdraw', reasonCode: 'forged' }, { decision: 'withdraw', reasonCode: 'spam', expectedVersion: 0 },
      { decision: 'withdraw', reasonCode: 'spam', publicId: 'invalid' },
    ]) expect(await decide(message.public_id, 'withdraw', extra)).toMatchObject({ ok: false })
    expect(await db`select * from app_private.moderation_actions`).toHaveLength(0)
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('rejects unavailable actors and rechecks revoked roles on reads and writes', async () => {
    const { message } = await fixture()
    await insertProfile(db, 'fan')
    await insertProfile(db, 'suspended', { role: 'admin', suspended_at: new Date().toISOString(), suspension_reason_code: 'spam' })
    await insertProfile(db, 'deleted', { role: 'owner', account_state: 'deletion_pending' })
    for (const clerkUserId of ['missing', 'fan', 'suspended', 'deleted']) {
      expect(await decide(message.public_id, 'approve', { clerkUserId })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
      expect(await searchModerationMessages(db, clerkUserId, { query: '', status: 'all', page: 1 })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    }
    await db`update app_private.profiles set role = 'fan' where clerk_user_id = 'admin'`
    expect(await decide(message.public_id, 'approve')).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('allows an owner to decide', async () => {
    const { message } = await fixture()
    await db`update app_private.profiles set role = 'owner' where clerk_user_id = 'admin'`
    expect(await decide(message.public_id, 'approve')).toMatchObject({ ok: true })
  })
  it('rejects a decision about a version edited by the author', async () => {
    const { message } = await fixture()
    expect(await updateMessage(db, { clerkUserId: 'author', publicId: message.public_id, expectedVersion: 1, content: 'Edited letter' })).toMatchObject({ ok: true })
    expect(await decide(message.public_id, 'approve')).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    expect(await db`select content, status, version from app_private.messages`).toMatchObject([{ content: 'Edited letter', status: 'pending', version: 2 }])
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })
  it('serializes concurrent decisions and rejects the stale decision', async () => {
    const { message } = await fixture()
    const other = createSecondConnection()
    try {
      const input = { clerkUserId: 'admin', publicId: message.public_id, expectedVersion: 1, decision: 'reject', reasonCode: 'spam' }
      const results = await Promise.all([moderateMessage(db, input), moderateMessage(other, input)])
      expect(results.filter(result => result.ok)).toHaveLength(1)
      expect(results.find(result => !result.ok)).toMatchObject({ error: { code: 'MESSAGE_VERSION_CONFLICT' } })
      expect(await db`select * from app_private.moderation_actions`).toHaveLength(1)
      expect(await db`select * from app_private.admin_audit`).toHaveLength(1)
    } finally { await other.end() }
  })
  it.each(['admin_audit', 'moderation_actions'])('rolls back the decision when %s insertion fails', async table => {
    const { message } = await fixture()
    await db.unsafe(`alter table app_private.${table} add constraint test_reject_moderation check (action <> 'reject')`)
    try {
      await expect(decide(message.public_id, 'reject', { reasonCode: 'spam' })).rejects.toThrow()
      expect(await db`select status, version from app_private.messages`).toMatchObject([{ status: 'pending', version: 1 }])
      expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
      expect(await db`select * from app_private.moderation_actions`).toHaveLength(0)
    } finally { await db.unsafe(`alter table app_private.${table} drop constraint test_reject_moderation`) }
  })
  it('preserves audit references after deleting the message and profiles', async () => {
    const { message } = await fixture()
    await decide(message.public_id, 'reject', { reasonCode: 'spam' })
    await truncateProductTables(db)
    expect(await db`select actor_id, message_id, subject_profile_id, message_public_id from app_private.moderation_actions`).toMatchObject([{ actor_id: null, message_id: null, subject_profile_id: null, message_public_id: message.public_id }])
  })
  it('keeps moderation history append-only and inaccessible to public and preview roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role', 'atiny_preview_reader']) {
      expect((await db`select has_table_privilege(${role}, 'app_private.moderation_actions', 'SELECT') as allowed`)[0].allowed).toBe(false)
    }
    expect((await db`select has_table_privilege('atiny_app_runtime', 'app_private.moderation_actions', 'UPDATE') as update, has_table_privilege('atiny_app_runtime', 'app_private.moderation_actions', 'DELETE') as delete`)[0]).toEqual({ update: false, delete: false })
  })
})

describe('moderation queue', () => {
  it('searches literal text and filters private states without exposing identity credentials', async () => {
    const { author } = await fixture()
    await insertMessage(db, author.id, { status: 'rejected', content: 'Private 100% letter', moderation_reason_code: 'privacy', moderation_note: 'Private note' })
    const result = await searchModerationMessages(db, 'admin', { query: '%', status: 'rejected', page: 1 })
    expect(result.ok && result.data.items).toHaveLength(1)
    if (result.ok) {
      expect(result.data.items[0]).toMatchObject({ content: 'Private 100% letter', reasonCode: 'privacy', note: 'Private note', publicVisible: false, decisions: [] })
      expect(JSON.stringify(result.data)).not.toContain('clerk_user_id')
      expect(result.data.items[0]).not.toHaveProperty('authorId')
    }
    expect((await searchModerationMessages(db, 'admin', { query: author.display_name, status: 'all', page: 1 })).ok).toBe(true)
  })
  it('paginates in a stable order and offers decisions consistent with current visibility', async () => {
    const { author, message } = await fixture()
    for (let i = 0; i < 25; i++) await insertMessage(db, author.id)
    const first = await searchModerationMessages(db, 'admin', { query: '', status: 'pending', page: 1 })
    const second = await searchModerationMessages(db, 'admin', { query: '', status: 'pending', page: 2 })
    expect(first.ok && first.data.items).toHaveLength(25)
    expect(first.ok && first.data.hasMore).toBe(true)
    expect(second.ok && second.data.items.map(item => item.publicId)).toEqual([message.public_id])
    expect(second.ok && second.data.items[0].decisions).toEqual(['approve', 'reject', 'withdraw'])
    await db`update app_private.settings set premoderation_enabled = true where id = 1`
    const hidden = await searchModerationMessages(db, 'admin', { query: message.public_id, status: 'pending', page: 1 })
    expect(hidden.ok && hidden.data.items[0].decisions).toEqual(['approve', 'reject'])
  })
  it('rejects invalid filters and unbounded searches or pagination', async () => {
    await fixture()
    for (const options of [{ query: '', status: 'forged', page: 1 }, { query: 'a'.repeat(101), status: 'all', page: 1 }, { query: '', status: 'all', page: 0 }, { query: '', status: 'all', page: 1.5 }]) {
      expect(await searchModerationMessages(db, 'admin', options)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    }
  })
})
