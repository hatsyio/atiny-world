import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSecondConnection, createTestDb, insertMessage, insertProfile, truncateProductTables } from '../support/database'
import { createMessage } from '@/server/messages/create-message'
import { updateMessage } from '@/server/messages/update-message'
import { deleteMessage } from '@/server/messages/delete-message'
import { moderateMessage } from '@/server/moderation/moderate-message'
import { setSuspension } from '@/server/moderation/accounts'
import { updateSettings } from '@/server/moderation/settings'
import { POST as invalidateEndpoint } from '@/app/api/internal/cache/invalidate/route'
import { geographicRepository } from '@/server/locations/geographic-repository'
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
  await db`delete from app_private.geographic_locations`
}
beforeEach(async () => {
  await clean(); backend.values.clear(); backend.invalidations = []; backend.onInvalidate = undefined
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true'); vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_PROJECT_ID', 'integration'); vi.stubEnv('VERCEL_ENV', 'production')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
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


async function inProduction<T>(operation: () => Promise<T>): Promise<T> {
  const previous = { VERCEL: process.env.VERCEL, VERCEL_ENV: process.env.VERCEL_ENV, PUBLIC_READ_CACHE_ENABLED: process.env.PUBLIC_READ_CACHE_ENABLED }
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true')
  try { return await operation() }
  finally { for (const [key, value] of Object.entries(previous)) vi.stubEnv(key, value) }
}
function useRelay(environment: string, beforeReceive?: () => Promise<void>) {
  vi.stubEnv('VERCEL', environment === 'preview' ? '1' : '')
  vi.stubEnv('VERCEL_ENV', environment); vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'false')
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_URL', 'https://production.example/api/internal/cache/invalidate')
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', 'a-shared-secret-for-production-invalidation')
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    await beforeReceive?.()
    return inProduction(() => invalidateEndpoint(new Request(url, init)))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
it.each(['preview', 'development'])('relays %s message writes after commit with reads disabled and Production caches warmed', async environment => {
  await insertProfile(db, 'author')
  await inProduction(() => expectPublic(0))
  let expectedRows = 1
  const fetch = useRelay(environment, async () => {
    expect((await other`select count(*)::int as count from app_private.messages`)[0].count).toBe(expectedRows)
  })
  const created = await createMessage(db, { clerkUserId: 'author', content: 'Committed from a shared-DB writer', location })
  expect(created.ok).toBe(true)
  if (!created.ok) return
  await inProduction(() => expectPublic(1, 'es', 'Madrid'))
  expect(await updateMessage(db, { clerkUserId: 'author', publicId: created.data.publicId, expectedVersion: 1, content: 'Edited by a shared-DB writer', location: { ...location, country: 'France', countryCode: 'fr', locality: 'Paris' } })).toMatchObject({ ok: true })
  await inProduction(() => expectPublic(1, 'fr', 'Paris'))
  expectedRows = 0
  expect(await deleteMessage(db, { clerkUserId: 'author', publicId: created.data.publicId, expectedVersion: 2, confirmation: true })).toMatchObject({ ok: true })
  await inProduction(() => expectPublic(0))
  expect(fetch).toHaveBeenCalledTimes(3)
  for (const [, init] of fetch.mock.calls) expect(JSON.parse(init.body as string)).toEqual({ groups: ['options', 'stats'] })
})
it.each(['preview', 'development'])('relays %s geographic saves and invalidates Production persisted-query variants', async environment => {
  const query = { kind: 'country' as const, name: 'Spain', country: 'es' }
  expect(await inProduction(() => geographicRepository(other).find(query))).toEqual([])
  const fetch = useRelay(environment, async () => {
    expect((await other`select identity from app_private.geographic_locations`)[0]?.identity).toBe('country:es')
  })
  const country = { id: 'country:es', kind: 'country' as const, name: 'Spain', country: 'Spain', countryCode: 'es', point: { latitude: 40, longitude: -3 }, bounds: { west: -10, south: 35, east: 5, north: 44 }, providerId: null, provider: 'Geoapify' as const, attribution: 'Geoapify', obtainedAt: new Date().toISOString() }
  expect(await geographicRepository(db).save(country)).toEqual(country)
  expect(await inProduction(() => geographicRepository(other).find(query))).toEqual([country])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ groups: ['geography'] })
})
it('does not forward rejected or rolled-back Preview writes', async () => {
  await insertProfile(db, 'admin', { role: 'admin' }); const author = await insertProfile(db, 'author')
  const message = await insertMessage(db, author.id)
  await inProduction(() => expectPublic(1))
  const fetch = useRelay('preview')
  expect(await deleteMessage(db, { clerkUserId: 'author', publicId: message.public_id, expectedVersion: 99, confirmation: true })).toMatchObject({ ok: false })
  await db`alter table app_private.admin_audit add constraint test_cache_relay_rollback check (action <> 'reject')`
  try {
    await expect(moderateMessage(db, { clerkUserId: 'admin', publicId: message.public_id, expectedVersion: 1, decision: 'reject', reasonCode: 'spam' })).rejects.toThrow()
  } finally { await db`alter table app_private.admin_audit drop constraint test_cache_relay_rollback` }
  expect(fetch).not.toHaveBeenCalled()
  await inProduction(() => expectPublic(1))
})
it('keeps committed Preview publication successful during a receiver outage', async () => {
  await insertProfile(db, 'author')
  const fetch = useRelay('preview')
  fetch.mockResolvedValue(new Response(null, { status: 503 }))
  expect(await createMessage(db, { clerkUserId: 'author', content: 'Committed during invalidation outage', location })).toMatchObject({ ok: true })
  expect((await other`select count(*)::int as count from app_private.messages`)[0].count).toBe(1)
  expect(fetch).toHaveBeenCalledTimes(1)
})
