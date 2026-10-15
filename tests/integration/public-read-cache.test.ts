import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSecondConnection, createTestDb, insertMessage, insertProfile, truncateProductTables } from '../support/database'
import { createMessage } from '@/server/messages/create-message'
import { updateMessage } from '@/server/messages/update-message'
import { deleteMessage } from '@/server/messages/delete-message'
import { moderateMessage } from '@/server/moderation/moderate-message'
import { setSuspension } from '@/server/moderation/accounts'
import { updateSettings } from '@/server/moderation/settings'
import { getPublicMessageStats, listPublicLetterCountries, listPublicLetterLocations } from '@/server/messages/public-repository'

const backend = vi.hoisted(() => ({ values: new Map<string, unknown>(), invalidations: [] as string[], onInvalidate: undefined as undefined | (() => Promise<void>) }))
vi.mock('@/server/cache/vercel-cache', () => ({ createVercelCache: () => ({
  get: async (key: string) => backend.values.get(key) ?? null,
  set: async (key: string, value: unknown) => { backend.values.set(key, structuredClone(value)) },
  invalidate: async (tags: string[]) => { backend.invalidations.push(...tags); await backend.onInvalidate?.() },
}) }))
vi.mock('@/server/observability/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }))
const db = createTestDb(), other = createSecondConnection()
async function clean() {
  await db`delete from app_private.moderation_actions`; await db`delete from app_private.admin_audit`
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 0, version = 1, updated_by = null where id = 1`
  await truncateProductTables(db)
}
beforeEach(async () => {
  await clean(); backend.values.clear(); backend.invalidations = []; backend.onInvalidate = undefined
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true'); vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_PROJECT_ID', 'integration'); vi.stubEnv('VERCEL_ENV', 'preview')
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => { await clean(); await db.end(); await other.end() })
async function expectPublic(letters: number, country = 'es', city: string | null = null) {
  expect(await getPublicMessageStats(other)).toEqual({ letters, countries: letters ? 1 : 0 })
  expect(await listPublicLetterCountries(other)).toEqual(letters ? [country] : [])
  expect(await listPublicLetterLocations(other)).toEqual(letters ? [{ country, city }] : [])
}
const location = { precision: 'approximate' as const, localityCenter: { latitude: 40, longitude: -3 }, locality: 'Madrid', country: 'España', countryCode: 'es' }
it('invalidates after committed publication, edit and deletion across independent SQL clients', async () => {
  await insertProfile(db, 'author'); await expectPublic(0)
  backend.onInvalidate = async () => { expect((await other`select count(*)::int as n from app_private.messages`)[0].n).toBe(1) }
  const created = await createMessage(db, { clerkUserId: 'author', content: 'A public letter', location })
  expect(created.ok).toBe(true)
  if (!created.ok) return
  backend.onInvalidate = undefined
  await expectPublic(1, 'es', 'Madrid')
  expect(await updateMessage(db, { clerkUserId: 'author', publicId: created.data.publicId, expectedVersion: 1, content: 'An edited letter', location: { ...location, country: 'France', countryCode: 'fr', locality: 'Paris' } })).toMatchObject({ ok: true })
  await expectPublic(1, 'fr', 'Paris')
  expect(await deleteMessage(db, { clerkUserId: 'author', publicId: created.data.publicId, expectedVersion: 2, confirmation: true })).toMatchObject({ ok: true })
  await expectPublic(0)
  expect(backend.invalidations).toHaveLength(6)
})
it.each(['approve', 'reject', 'withdraw'])('invalidates moderation %s, including public visibility removal', async decision => {
  await insertProfile(db, 'admin', { role: 'admin' }); const author = await insertProfile(db, 'author')
  const message = await insertMessage(db, author.id)
  await expectPublic(1)
  expect(await moderateMessage(db, { clerkUserId: 'admin', publicId: message.public_id, expectedVersion: 1, decision, ...(decision === 'approve' ? {} : { reasonCode: 'spam' }) })).toMatchObject({ ok: true })
  await expectPublic(decision === 'approve' ? 1 : 0)
  expect(backend.invalidations).toHaveLength(2)
})
it('invalidates suspension/reactivation and both global premoderation changes', async () => {
  await insertProfile(db, 'admin', { role: 'admin' }); const author = await insertProfile(db, 'author')
  await insertMessage(db, author.id); await expectPublic(1)
  expect(await setSuspension(db, { clerkUserId: 'admin', publicId: author.public_id, suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode: 'spam' })).toMatchObject({ ok: true })
  await expectPublic(0)
  expect(await setSuspension(db, { clerkUserId: 'admin', publicId: author.public_id, suspended: false, expectedRoleVersion: 1, expectedSuspensionVersion: 2 })).toMatchObject({ ok: true })
  await expectPublic(1)
  for (const [premoderationEnabled, expectedVersion] of [[true, 1], [false, 2]] as const) {
    expect(await updateSettings(db, { clerkUserId: 'admin', premoderationEnabled, messageLimit: 10, cooldownSeconds: 0, expectedVersion, expectedPendingActiveMessages: 1, confirmedImpact: true })).toMatchObject({ ok: true })
    await expectPublic(premoderationEnabled ? 0 : 1)
  }
  expect(backend.invalidations).toHaveLength(8)
})
it('does not invalidate rejected mutations or rolled-back transactions', async () => {
  await insertProfile(db, 'admin', { role: 'admin' }); const author = await insertProfile(db, 'author')
  const message = await insertMessage(db, author.id); await expectPublic(1)
  expect(await deleteMessage(db, { clerkUserId: 'author', publicId: message.public_id, expectedVersion: 99, confirmation: true })).toMatchObject({ ok: false })
  await db`alter table app_private.admin_audit add constraint test_cache_rollback check (action <> 'reject')`
  try {
    await expect(moderateMessage(db, { clerkUserId: 'admin', publicId: message.public_id, expectedVersion: 1, decision: 'reject', reasonCode: 'spam' })).rejects.toThrow()
  } finally { await db`alter table app_private.admin_audit drop constraint test_cache_rollback` }
  expect(backend.invalidations).toHaveLength(0)
  await expectPublic(1)
})
