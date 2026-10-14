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
