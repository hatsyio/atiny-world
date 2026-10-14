import 'server-only'
import type { GeographicLocation, GeographicQuery } from '@/domain/location/geographic-location'
import { normalizeCitySearch } from '@/domain/location/city-search'
import { getGeoapifyApiKey } from '../env'
import { GeoapifyProviderError } from './geoapify'

const numberIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const string = (value: unknown): string | null => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000 ? value.trim() : null

export function normalizeGeographicResult(input: unknown, kind: GeographicLocation['kind']): GeographicLocation | null {
  if (!input || typeof input !== 'object') return null
  const result = input as Record<string, unknown>
  const country = string(result.country)
  const countryCode = string(result.country_code)?.toLowerCase()
  const name = kind === 'country' ? country : string(result.city) ?? string(result.town) ?? string(result.village) ?? string(result.municipality)
  if (!name || !country || !countryCode || !/^[a-z]{2}$/.test(countryCode) || !numberIn(result.lat, -90, 90) || !numberIn(result.lon, -180, 180)) return null
  const bbox = result.bbox as Record<string, unknown> | undefined
  const bounds = bbox && numberIn(bbox.lon1, -180, 180) && numberIn(bbox.lon2, -180, 180) && numberIn(bbox.lat1, -90, 90) && numberIn(bbox.lat2, -90, 90) && bbox.lon1 < bbox.lon2 && bbox.lat1 < bbox.lat2
    ? { west: bbox.lon1, south: bbox.lat1, east: bbox.lon2, north: bbox.lat2 } : null
  // Country framing requires its complete bounds; a city can fall back to its center.
  if (kind === 'country' && !bounds) return null
  const providerId = string(result.place_id)
  const id = kind === 'country' ? `country:${countryCode}` : providerId ? `city:geoapify:${providerId}` : `city:${countryCode}:${normalizeCitySearch(name)}:${result.lat}:${result.lon}`
  return { id, kind, name, country, countryCode, point: { latitude: result.lat, longitude: result.lon }, bounds, providerId, provider: 'Geoapify', attribution: 'Powered by Geoapify | © OpenStreetMap contributors', obtainedAt: new Date().toISOString() }
}

export async function searchGeographicLocations(query: GeographicQuery, dependencies: { fetch?: typeof fetch; apiKey?: string } = {}): Promise<GeographicLocation[]> {
  const params = new URLSearchParams({ text: query.name, type: query.kind, format: 'json', limit: '10', lang: 'en' })
  if (query.country) params.set('filter', `countrycode:${query.country}`)
  try {
    const response = await (dependencies.fetch ?? fetch)(`https://api.geoapify.com/v1/geocode/search?${params}`, {
      headers: { 'x-api-key': dependencies.apiKey ?? getGeoapifyApiKey() }, signal: AbortSignal.timeout(5000), cache: 'no-store',
    })
    if (!response.ok) throw new GeoapifyProviderError(response.status === 429 ? 'rate_limited' : 'unavailable')
    const payload = await response.json()
    if (!Array.isArray(payload?.results)) throw new GeoapifyProviderError('unavailable')
    return payload.results.map((result: unknown) => normalizeGeographicResult(result, query.kind))
      .filter((location: GeographicLocation | null): location is GeographicLocation => Boolean(location && (!query.country || location.countryCode === query.country) && (query.kind === 'country' || normalizeCitySearch(location.name) === normalizeCitySearch(query.name))))
  } catch (error) {
    if (error instanceof GeoapifyProviderError) throw error
    throw new GeoapifyProviderError('unavailable')
  }
}
