import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createSql } from '@/server/db/sql'
import { listPublicLetterCountries, listPublicLetterLocations, getPublicMessageStats } from '@/server/messages/public-repository'
import { geographicRepository } from '@/server/locations/geographic-repository'
import { invalidatePublicReads } from '@/server/cache'

const shared = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@/server/cache/vercel-cache', () => ({ createVercelCache: () => ({
  get: async (key: string) => shared.get(key) ?? null,
  set: async (key: string, value: unknown) => { shared.set(key, structuredClone(value)) },
  invalidate: async () => {},
}) }))
vi.mock('@/server/observability/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }))
const geo = { identity: 'country:es', kind: 'country', name: 'Spain', country: 'Spain', country_code: 'es', latitude: 40, longitude: -3, west: -10, south: 35, east: 5, north: 44, provider_id: null, provider: 'Geoapify', attribution: 'Geoapify', obtained_at: new Date() }
function database(rows: unknown[]) {
  const query = vi.fn(async () => ({ rows }))
  return { sql: createSql({ query, connect: vi.fn(), end: vi.fn() }), query }
}
beforeEach(() => {
  shared.clear()
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true'); vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_PROJECT_ID', 'test'); vi.stubEnv('VERCEL_ENV', 'production')
})
afterEach(() => vi.unstubAllEnvs())
it('reuses only the three selected public SQL reads and invalidates options and stats', async () => {
  const countries = database([{ country_code: 'es' }])
  const locations = database([{ country: 'es', city: 'Madrid' }])
  const stats = database([{ letters: 1, countries: 1 }])
  for (let i = 0; i < 2; i++) {
    expect(await listPublicLetterCountries(countries.sql)).toEqual(['es'])
    expect(await listPublicLetterLocations(locations.sql)).toEqual([{ country: 'es', city: 'Madrid' }])
    expect(await getPublicMessageStats(stats.sql)).toEqual({ letters: 1, countries: 1 })
  }
  for (const db of [countries, locations, stats]) expect(db.query).toHaveBeenCalledTimes(1)
  await invalidatePublicReads()
  await listPublicLetterCountries(countries.sql); await listPublicLetterLocations(locations.sql); await getPublicMessageStats(stats.sql)
  for (const db of [countries, locations, stats]) expect(db.query).toHaveBeenCalledTimes(2)
})
it('bypasses storage when disabled', async () => {
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'false')
  const { sql, query } = database([{ country_code: 'es' }])
  await listPublicLetterCountries(sql); await listPublicLetterCountries(sql)
  expect(query).toHaveBeenCalledTimes(2)
  expect(shared.size).toBe(0)
})
it('caches persisted geography, validates keys, and invalidates all query variants after saving', async () => {
  const { sql, query } = database([geo])
  const repo = geographicRepository(sql)
  await repo.byId('country:es'); await repo.byId('country:es')
  await repo.find({ kind: 'country', name: 'Spain', country: 'es' }); await repo.find({ kind: 'country', name: 'Spain', country: 'es' })
  expect(query).toHaveBeenCalledTimes(2)
  expect(await repo.byId('')).toBeNull()
  expect(await repo.find({ kind: 'city', name: '!!!' })).toEqual([])
  expect(query).toHaveBeenCalledTimes(2)
  const location = (await repo.byId('country:es'))!
  await repo.save(location)
  await repo.byId('country:es'); await repo.find({ kind: 'country', name: 'Spain', country: 'es' })
  expect(query).toHaveBeenCalledTimes(6)
})
it('bypasses geography cache inside transactions and never caches visibility-dependent ordering', async () => {
  const { sql, query } = database([geo])
  const tx = Object.assign(sql.bind(null), { json: sql.json, unsafe: sql.unsafe })
  const repo = geographicRepository(tx)
  await repo.byId('country:es'); await repo.byId('country:es')
  expect(query).toHaveBeenCalledTimes(2)
  expect(shared.size).toBe(0)
})
it('keeps visibility-dependent geographic preference on SQL for every request', async () => {
  const { sql, query } = database([geo])
  const repo = geographicRepository(sql)
  const location = (await repo.byId('country:es'))!
  const cities = [{ ...location, id: 'city:geoapify:a', kind: 'city' as const }, { ...location, id: 'city:geoapify:b', kind: 'city' as const }]
  await repo.preferPublicCity(cities); await repo.preferPublicCity(cities)
  expect(query).toHaveBeenCalledTimes(3)
})
it('falls back to persisted SQL rather than provider search on corrupt geographic cache values', async () => {
  const { sql, query } = database([geo])
  const repo = geographicRepository(sql)
  await repo.byId('country:es')
  for (const [key, value] of shared) if (typeof value === 'object') shared.set(key, { ...value, point: { latitude: 500, longitude: 0 } })
  expect((await repo.byId('country:es'))?.point.latitude).toBe(40)
  expect(query).toHaveBeenCalledTimes(2)
})

it.each(['preview', 'development', ''])('bypasses read caching in %s even when explicitly enabled', async environment => {
  vi.stubEnv('VERCEL_ENV', environment)
  const { sql, query } = database([{ country_code: 'es' }])
  await listPublicLetterCountries(sql); await listPublicLetterCountries(sql)
  expect(query).toHaveBeenCalledTimes(2)
  expect(shared.size).toBe(0)
})
