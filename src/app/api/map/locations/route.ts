import { createFixedWindowRateLimiter, getClientKey } from '@/server/http/rate-limit'
import { getDb } from '@/server/db/client'
import { geographicRepository } from '@/server/locations/geographic-repository'
import { resolveGeographicLocations } from '@/server/locations/geographic-service'
import { searchGeographicLocations } from '@/server/locations/geographic-provider'
import { mapCountries } from '@/i18n/countries'

const providerLimit = createFixedWindowRateLimiter()
class LookupRateLimit extends Error { constructor(readonly retryAfter: number) { super('Rate limited') } }

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const id = params.get('id')
  const city = params.get('city')?.trim() ?? ''
  const country = params.get('country') ?? undefined
  if ((id !== null && (!id || id.length > 1500)) || (id === null && (!city && !country || city.length > 100 || country !== undefined && !mapCountries.en.some(option => option.value === country)))) return Response.json({ error: 'Invalid location' }, { status: 400 })
  try {
    const repository = geographicRepository(getDb())
    const locations = id ? [await repository.byId(id)].filter(location => location !== null) : await resolveGeographicLocations({ kind: city ? 'city' : 'country', name: city || mapCountries.en.find(option => option.value === country)!.label, country }, { ...repository, search: async query => {
      const limit = providerLimit(getClientKey(request))
      if (!limit.allowed) throw new LookupRateLimit(limit.retryAfterSeconds)
      return searchGeographicLocations(query)
    } })
    const ordered = !id && city ? await repository.preferPublicCity(locations) : locations
    return Response.json({ locations: ordered }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (error instanceof LookupRateLimit) return Response.json({ error: 'Too many location lookups' }, { status: 429, headers: { 'retry-after': String(error.retryAfter), 'cache-control': 'no-store' } })
    return Response.json({ error: 'Location unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
