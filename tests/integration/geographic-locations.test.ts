import { afterAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createTestDb } from '../support/database'
import { geographicRepository } from '@/server/locations/geographic-repository'
import { normalizeGeographicResult } from '@/server/locations/geographic-provider'
import { resolveGeographicLocations } from '@/server/locations/geographic-service'

const db = createTestDb()
afterAll(() => db.end())
it('persists minimal shared metadata and uniquely reuses homonymous cities through the runtime role', async () => {
  const repo = geographicRepository(db)
  const cities = [40.4, 41.4].map((lat, index) => normalizeGeographicResult({ city: 'Madrid129Fixture', country: 'Spain', country_code: 'es', lat, lon: -3.7, place_id: `issue129-fixture-${index}`, bbox: { lon1: -4, lat1: 40, lon2: -3, lat2: 42 }, fullResponse: 'must not persist' }, 'city')!)
  const query = { kind: 'city' as const, name: 'Madrid129Fixture', country: 'es' }
  try {
    const search = vi.fn(async () => cities)
    await db.begin(async tx => {
      await tx`set local role atiny_app_runtime`
      const runtimeRepo = geographicRepository(tx)
      await resolveGeographicLocations(query, { ...runtimeRepo, search })
    })
    // Separate caller/connection reads the same persisted rows.
    const secondDb = createTestDb()
    try {
      const reused = await resolveGeographicLocations(query, { ...geographicRepository(secondDb), search })
      expect(reused.map(city => city.id)).toEqual(cities.map(city => city.id))
      expect(reused[0].bounds).toEqual(cities[0].bounds)
      expect(search).toHaveBeenCalledTimes(1)
    } finally { await secondDb.end() }
    await Promise.all([repo.save(cities[0]), repo.save(cities[0])])
    expect(await repo.find(query)).toHaveLength(2)
    const [permissions] = await db<{ anon: boolean; preview: boolean; runtime: boolean; columns: string[] }[]>`
      select has_table_privilege('anon', 'app_private.geographic_locations', 'SELECT') as anon,
        has_table_privilege('atiny_preview_reader', 'app_private.geographic_locations', 'SELECT') as preview,
        has_table_privilege('atiny_app_runtime', 'app_private.geographic_locations', 'INSERT') as runtime,
        array(select column_name from information_schema.columns where table_schema = 'app_private' and table_name = 'geographic_locations') as columns`
    expect(permissions.anon).toBe(false)
    expect(permissions.preview).toBe(false)
    expect(permissions.runtime).toBe(true)
    expect(permissions.columns).not.toContain('response')
    await expect(db`insert into app_private.geographic_locations select * from app_private.geographic_locations where identity = ${cities[0].id}`).rejects.toThrow()
    await expect(db`update app_private.geographic_locations set latitude = 91 where identity = ${cities[0].id}`).rejects.toThrow()
  } finally { await db`delete from app_private.geographic_locations where identity in (${cities[0].id}, ${cities[1].id})` }
})
