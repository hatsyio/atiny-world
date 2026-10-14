import { afterAll, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { GET } from '@/app/api/map/locations/route'
import { getDb } from '@/server/db/client'
import { geographicRepository } from '@/server/locations/geographic-repository'
import { normalizeGeographicResult } from '@/server/locations/geographic-provider'
const db = getDb()
afterAll(() => db.end())

it('rejects invalid and incomplete geographic requests before reaching the provider', async () => {
  for (const query of ['', '?country=zz', '?city=' + 'x'.repeat(101), '?id=']) {
    expect((await GET(new Request('http://localhost/api/map/locations' + query))).status).toBe(400)
  }
})
it('serves a persisted identity without geocoding, including cities with no bounds or letters', async () => {
  const location = normalizeGeographicResult({ city: 'Contract129', country: 'Spain', country_code: 'es', lat: 40, lon: -3, place_id: 'contract129' }, 'city')!
  const provider = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Provider must not be used'))
  try {
    await geographicRepository(db).save(location)
    const response = await GET(new Request(`http://localhost/api/map/locations?id=${encodeURIComponent(location.id)}`))
    expect(response.status).toBe(200)
    expect((await response.json()).locations[0]).toMatchObject({ id: location.id, bounds: null, point: location.point })
    const named = await GET(new Request('http://localhost/api/map/locations?city=Contract129&country=es'))
    expect(named.status).toBe(200)
    expect((await named.json()).locations).toHaveLength(1)
    expect(provider).not.toHaveBeenCalled()
    const unknown = await GET(new Request('http://localhost/api/map/locations?id=city:missing'))
    expect((await unknown.json()).locations).toEqual([])
  } finally { provider.mockRestore(); await db`delete from app_private.geographic_locations where identity = ${location.id}` }
})
it('reports provider failure without exposing its key or exception', async () => {
  const provider = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Private provider detail'))
  try {
    const response = await GET(new Request('http://localhost/api/map/locations?city=Nonexistent129'))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('Private provider detail')
  } finally { provider.mockRestore() }
})

it('limits uncached public lookups without limiting persisted reads', async () => {
  const provider = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  try {
    for (let index = 0; index < 30; index++) {
      expect((await GET(new Request('http://localhost/api/map/locations?city=RateLimitFixture129', { headers: { 'x-real-ip': 'contract-rate-fixture129' } }))).status).toBe(503)
    }
    const response = await GET(new Request('http://localhost/api/map/locations?city=RateLimitFixture129', { headers: { 'x-real-ip': 'contract-rate-fixture129' } }))
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await GET(new Request('http://localhost/api/map/locations?id=unknown', { headers: { 'x-real-ip': 'contract-rate-fixture129' } }))).status).toBe(200)
  } finally { provider.mockRestore() }
})

it('prefers the homonymous city near visible letters over unrelated and suspended authors points', async () => {
  const repo = geographicRepository(db)
  const locations = [41, 40].map((lat, index) => normalizeGeographicResult({ city: 'Homonym129', country: 'Spain', country_code: 'es', lat, lon: -3, place_id: `homonym129-${index}` }, 'city')!)
  const username = `homonym129-${Date.now()}`
  const authors = await db<{ id: string }[]>`insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name, suspended_at, suspension_reason_code)
    values (${username}, ${username}, ${username}, 'Visible', null, null),
      (${username + '-hidden'}, ${username + '-hidden'}, ${username + '-hidden'}, 'Hidden', now(), 'spam') returning id`
  try {
    for (const location of locations) await repo.save(location)
    await db`insert into app_private.messages (author_id, content, status, location_precision, location_algorithm_version, public_point, locality, country, country_code)
      values (${authors[0].id}, 'visible homonym fixture', 'approved', 'approximate', 1, ST_SetSRID(ST_MakePoint(-3,40.01),4326)::geography, 'Homonym129', 'Spain', 'es'),
        (${authors[1].id}, 'hidden homonym fixture', 'approved', 'approximate', 1, ST_SetSRID(ST_MakePoint(-3,41),4326)::geography, 'Homonym129', 'Spain', 'es')`
    await db.begin(async tx => {
      await tx`set local role atiny_app_runtime`
      expect((await geographicRepository(tx).preferPublicCity(locations))[0].id).toBe(locations[1].id)
    })
    const response = await GET(new Request('http://localhost/api/map/locations?city=Homonym129&country=es'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.locations).toHaveLength(2)
    expect(body.locations[0].id).toBe(locations[1].id)
    const restored = await GET(new Request(`http://localhost/api/map/locations?id=${encodeURIComponent(body.locations[0].id)}`))
    expect((await restored.json()).locations[0].id).toBe(locations[1].id)
  } finally {
    await db`delete from app_private.messages where author_id = any(${authors.map(author => author.id)}::bigint[])`
    await db`delete from app_private.profiles where id = any(${authors.map(author => author.id)}::bigint[])`
    await db`delete from app_private.geographic_locations where identity = any(${locations.map(location => location.id)}::text[])`
  }
})
