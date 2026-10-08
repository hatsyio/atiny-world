import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createSecondConnection, createTestDb, currentSettings, insertMessage, insertProfile, truncateProductTables } from '../support/database'
import { getAdminSettings, updateSettings } from '@/server/moderation/settings'

const db = createTestDb()

async function clean() {
  await db`delete from app_private.admin_audit`
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 10, version = 1, updated_by = null where id = 1`
  await truncateProductTables(db)
}

beforeEach(clean)
afterAll(async () => { await clean(); await db.end() })

async function fixture() {
  const actor = await insertProfile(db, 'admin', { role: 'admin' })
  const activeAuthor = await insertProfile(db, 'active-author')
  const suspendedAuthor = await insertProfile(db, 'suspended-author', { suspended_at: new Date().toISOString(), suspension_reason_code: 'spam' })
  const pending = await insertMessage(db, activeAuthor.id, { content: 'Pending letter' })
  await insertMessage(db, activeAuthor.id, { status: 'approved', content: 'Approved letter' })
  await insertMessage(db, suspendedAuthor.id, { content: 'Suspended pending letter' })
  return { actor, pending }
}

const change = (overrides: Partial<{ clerkUserId: string; premoderationEnabled: boolean; messageLimit: number; cooldownSeconds: number; expectedVersion: number; expectedPendingActiveMessages: number; confirmedImpact: boolean }> = {}) => updateSettings(db, {
  clerkUserId: 'admin',
  premoderationEnabled: true,
  messageLimit: 25,
  cooldownSeconds: 0,
  expectedVersion: 1,
  expectedPendingActiveMessages: 1,
  confirmedImpact: true,
  ...overrides,
})

describe('administrative settings', () => {
  it('shows only active pending letters as the premoderation impact', async () => {
    await fixture()
    expect(await getAdminSettings(db, 'admin')).toEqual({
      ok: true,
      data: {
        premoderationEnabled: false,
        messageLimit: 10,
        cooldownSeconds: 10,
        version: 1,
        pendingActiveMessages: 1,
      },
    })
  })

  it.each(['admin', 'owner'])('allows %s to update settings and audit atomically without rewriting messages', async role => {
    const { actor, pending } = await fixture()
    await db`update app_private.profiles set role = ${role} where id = ${actor.id}`
    const before = await db`select content, status, public_point::text, published_at from app_private.messages where id = ${pending.id}`
    await db`set role atiny_app_runtime`
    try {
      expect(await change()).toEqual({
        ok: true,
        data: {
          premoderationEnabled: true,
          messageLimit: 25,
          cooldownSeconds: 0,
          version: 2,
          hiddenPendingMessages: 1,
          appearingPendingMessages: 0,
        },
      })
    } finally {
      await db`reset role`
    }
    expect(await db`select content, status, public_point::text, published_at from app_private.messages where id = ${pending.id}`).toEqual(before)
    expect(await currentSettings(db)).toMatchObject({ premoderation_enabled: true, message_limit: 25, cooldown_seconds: 0, version: 2 })
    expect(await db`select actor_id, action, target_type, metadata from app_private.admin_audit`).toEqual([{
      actor_id: actor.id,
      action: 'update_settings',
      target_type: 'settings',
      metadata: {
        previousPremoderationEnabled: false,
        premoderationEnabled: true,
        previousMessageLimit: 10,
        messageLimit: 25,
        previousCooldownSeconds: 10,
        cooldownSeconds: 0,
        previousVersion: 1,
        version: 2,
        hiddenPendingMessages: 1,
        appearingPendingMessages: 0,
      },
    }])
  })

  it('reports pending letters that appear when premoderation is disabled', async () => {
    await fixture()
    await db`update app_private.settings set premoderation_enabled = true, version = 4 where id = 1`
    expect(await change({ premoderationEnabled: false, expectedVersion: 4 })).toMatchObject({
      ok: true,
      data: { appearingPendingMessages: 1, hiddenPendingMessages: 0, version: 5 },
    })
  })

  it('rejects invalid values and stale settings without writes', async () => {
    await fixture()
    for (const input of [
      { messageLimit: 0 }, { messageLimit: 1.5 }, { cooldownSeconds: -1 }, { cooldownSeconds: 1.5 }, { expectedVersion: 0 }, { expectedPendingActiveMessages: -1 },
    ]) expect(await change(input)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await change({ expectedVersion: 2 })).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
    expect(await currentSettings(db)).toMatchObject({ premoderation_enabled: false, message_limit: 10, cooldown_seconds: 10, version: 1 })
  })

  it('rejects a premoderation confirmation when its impact changed', async () => {
    const { actor } = await fixture()
    await insertMessage(db, actor.id, { content: 'New pending letter' })
    expect(await change()).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    expect(await currentSettings(db)).toMatchObject({ premoderation_enabled: false, version: 1 })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })

  it('requires an explicit confirmation when premoderation changes', async () => {
    await fixture()
    expect(await change({ confirmedImpact: false })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await currentSettings(db)).toMatchObject({ premoderation_enabled: false, version: 1 })
  })

  it('waits for an in-flight publication before it checks the confirmed impact', async () => {
    await fixture()
    const other = createSecondConnection()
    let updateDone = false
    let attempt: ReturnType<typeof updateSettings> | undefined
    try {
      await other.begin(async tx => {
        const authors = await tx<{ id: string }[]>`
          insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name)
          values ('in-flight-author', 'in-flight-author', 'in-flight-author', 'In flight author')
          returning id
        `
        await tx`select id from app_private.settings where id = 1 for share`
        await tx`
          insert into app_private.messages (author_id, content, location_precision, location_algorithm_version, public_point, country, country_code)
          values (${authors[0].id}, 'In-flight pending letter', 'approximate', 1,
            ST_SetSRID(ST_MakePoint(-2.5, 39.5), 4326)::geography, 'España', 'es')
        `
        attempt = updateSettings(db, {
          clerkUserId: 'admin', premoderationEnabled: true, messageLimit: 25,
          cooldownSeconds: 0, expectedVersion: 1, expectedPendingActiveMessages: 1, confirmedImpact: true,
        }).then(result => { updateDone = true; return result })
        await new Promise(resolve => setTimeout(resolve, 25))
        expect(updateDone).toBe(false)
      })
      expect(await attempt).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    } finally {
      await other.end()
    }
  })

  it('waits for an in-flight edit that returns an approved letter to pending', async () => {
    const { pending } = await fixture()
    const approved = (await db`select id from app_private.messages where status = 'approved'`)[0]
    const other = createSecondConnection()
    let updateDone = false
    let attempt: ReturnType<typeof updateSettings> | undefined
    try {
      await other.begin(async tx => {
        await tx`select id from app_private.settings where id = 1 for share`
        await tx`update app_private.messages set status = 'pending' where id = ${approved.id}`
        attempt = updateSettings(db, {
          clerkUserId: 'admin', premoderationEnabled: true, messageLimit: 25,
          cooldownSeconds: 0, expectedVersion: 1, expectedPendingActiveMessages: 1, confirmedImpact: true,
        }).then(result => { updateDone = true; return result })
        await new Promise(resolve => setTimeout(resolve, 25))
        expect(updateDone).toBe(false)
      })
      expect(await attempt).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
      expect(await db`select status from app_private.messages where id = ${pending.id}`).toEqual([{ status: 'pending' }])
    } finally {
      await other.end()
    }
  })

  it('waits for an in-flight deletion of a pending letter', async () => {
    const { pending } = await fixture()
    const other = createSecondConnection()
    let updateDone = false
    let attempt: ReturnType<typeof updateSettings> | undefined
    try {
      await other.begin(async tx => {
        await tx`select id from app_private.settings where id = 1 for share`
        await tx`delete from app_private.messages where id = ${pending.id}`
        attempt = updateSettings(db, {
          clerkUserId: 'admin', premoderationEnabled: true, messageLimit: 25,
          cooldownSeconds: 0, expectedVersion: 1, expectedPendingActiveMessages: 1, confirmedImpact: true,
        }).then(result => { updateDone = true; return result })
        await new Promise(resolve => setTimeout(resolve, 25))
        expect(updateDone).toBe(false)
      })
      expect(await attempt).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    } finally {
      await other.end()
    }
  })

  it('rechecks current administrator access inside the transaction', async () => {
    await fixture()
    for (const clerkUserId of ['missing']) expect(await change({ clerkUserId })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    await db`update app_private.profiles set role = 'fan' where clerk_user_id = 'admin'`
    expect(await change()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
  })

  it('serializes simultaneous writes and rejects the stale settings form', async () => {
    await fixture()
    const other = createSecondConnection()
    try {
      const input = { clerkUserId: 'admin', premoderationEnabled: true, messageLimit: 25, cooldownSeconds: 0, expectedVersion: 1, expectedPendingActiveMessages: 1, confirmedImpact: true }
      const results = await Promise.all([updateSettings(db, input), updateSettings(other, input)])
      expect(results.filter(result => result.ok)).toHaveLength(1)
      expect(results.find(result => !result.ok)).toMatchObject({ error: { code: 'MESSAGE_VERSION_CONFLICT' } })
      expect(await db`select * from app_private.admin_audit`).toHaveLength(1)
    } finally {
      await other.end()
    }
  })

  it('rolls back settings when the audit insert fails', async () => {
    await fixture()
    await db.unsafe("alter table app_private.admin_audit add constraint test_reject_settings_audit check (action <> 'update_settings')")
    try {
      await expect(change()).rejects.toThrow()
      expect(await currentSettings(db)).toMatchObject({ premoderation_enabled: false, message_limit: 10, cooldown_seconds: 10, version: 1 })
      expect(await db`select * from app_private.admin_audit`).toHaveLength(0)
    } finally {
      await db`alter table app_private.admin_audit drop constraint test_reject_settings_audit`
    }
  })
})
