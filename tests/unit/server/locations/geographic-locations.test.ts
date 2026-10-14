import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { normalizeGeographicResult, searchGeographicLocations } from '@/server/locations/geographic-provider'
import { resolveGeographicLocations } from '@/server/locations/geographic-service'

const madrid = { city: 'Madrid', country: 'Spain', country_code: 'es', lat: 40.4, lon: -3.7, place_id: 'madrid-es', bbox: { lon1: -3.9, lat1: 40.3, lon2: -3.5, lat2: 40.6 } }
it('validates center and bounds and only retains allowed geographic fields', () => {
  const result = normalizeGeographicResult({ ...madrid, address: 'secret' }, 'city')!
  expect(result.name).toBe('Madrid')
  expect(result.bounds).toEqual({ west: -3.9, south: 40.3, east: -3.5, north: 40.6 })
  expect(result).not.toHaveProperty('address')
  expect(normalizeGeographicResult({ ...madrid, lat: 200 }, 'city')).toBeNull()
  expect(normalizeGeographicResult({ ...madrid, bbox: { lon1: 9, lon2: 0 } }, 'city')?.bounds).toBeNull()
  expect(normalizeGeographicResult({ ...madrid, place_id: undefined }, 'city')?.id).toContain('40.4')
})
it('scopes Geoapify to the requested country and discards wrong-country and partial matches', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ results: [madrid, { ...madrid, country_code: 'us' }, { ...madrid, city: 'Madridejos' }] })))
  const result = await searchGeographicLocations({ kind: 'city', name: 'Madrid', country: 'es' }, { fetch: fetcher, apiKey: 'server-key' })
  expect(result).toHaveLength(1)
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('filter')).toBe('countrycode:es')
  expect(result[0].providerId).toBe('madrid-es')
})
it('uses persisted data across requests without contacting the provider', async () => {
  const location = normalizeGeographicResult(madrid, 'city')!
  const stored = new Map<string, typeof location>()
  const deps = { find: async () => [...stored.values()], save: async (value: typeof location) => { stored.set(value.id, value); return value }, search: vi.fn(async () => [location]) }
  expect(await resolveGeographicLocations({ kind: 'city', name: 'Madrid', country: 'es' }, deps)).toEqual([location])
  expect(await resolveGeographicLocations({ kind: 'city', name: 'Madrid', country: 'es' }, deps)).toEqual([location])
  expect(deps.search).toHaveBeenCalledTimes(1)
})
it('does not silently choose between homonyms or save unusable responses', async () => {
  const first = normalizeGeographicResult(madrid, 'city')!
  const second = normalizeGeographicResult({ ...madrid, lat: 41, place_id: 'another-madrid' }, 'city')!
  const deps = { find: async () => [], save: async (value: typeof first) => value, search: async () => [first, second] }
  expect(await resolveGeographicLocations({ kind: 'city', name: 'Madrid' }, deps)).toEqual([first, second])
  await expect(resolveGeographicLocations({ kind: 'city', name: 'Madrid' }, { ...deps, search: async () => { throw new Error('offline') } })).rejects.toThrow('offline')
})

it('resolves a same-named city in a different country without confusing it with a persisted city', async () => {
  const spain = normalizeGeographicResult(madrid, 'city')!
  const usa = normalizeGeographicResult({ ...madrid, country: 'United States', country_code: 'us', lat: 42, lon: -93, place_id: 'madrid-us' }, 'city')!
  const deps = { find: async (query: { country?: string }) => query.country === 'es' ? [spain] : [], search: vi.fn(async () => [usa]), save: async (location: typeof usa) => location }
  expect(await resolveGeographicLocations({ kind: 'city', name: 'Madrid', country: 'us' }, deps)).toEqual([usa])
  expect(deps.search).toHaveBeenCalledTimes(1)
})
