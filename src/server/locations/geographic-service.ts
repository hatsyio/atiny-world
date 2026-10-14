import type { GeographicLocation, GeographicQuery } from '@/domain/location/geographic-location'

export async function resolveGeographicLocations(query: GeographicQuery, dependencies: {
  find: (query: GeographicQuery) => Promise<GeographicLocation[]>
  search: (query: GeographicQuery) => Promise<GeographicLocation[]>
  save: (location: GeographicLocation) => Promise<GeographicLocation>
}): Promise<GeographicLocation[]> {
  const persisted = await dependencies.find(query)
  if (persisted.length) return persisted
  const locations = await dependencies.search(query)
  const saved: GeographicLocation[] = []
  for (const location of locations) saved.push(await dependencies.save(location))
  return [...new Map(saved.map(location => [location.id, location])).values()]
}
