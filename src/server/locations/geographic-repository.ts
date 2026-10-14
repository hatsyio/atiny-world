import type { Sql, TransactionSql } from '@/server/db/sql'
import type { GeographicLocation, GeographicQuery } from '@/domain/location/geographic-location'
import { normalizeCitySearch } from '@/domain/location/city-search'

type Row = { identity: string; kind: GeographicLocation['kind']; name: string; country: string; country_code: string; latitude: number; longitude: number; west: number | null; south: number | null; east: number | null; north: number | null; provider_id: string | null; provider: 'Geoapify'; attribution: string; obtained_at: Date }
const project = (row: Row): GeographicLocation => ({ id: row.identity, kind: row.kind, name: row.name, country: row.country, countryCode: row.country_code, point: { latitude: row.latitude, longitude: row.longitude }, bounds: row.west === null ? null : { west: row.west, south: row.south!, east: row.east!, north: row.north! }, providerId: row.provider_id, provider: row.provider, attribution: row.attribution, obtainedAt: row.obtained_at.toISOString() })

export function geographicRepository(sql: Sql | TransactionSql) {
  return {
    async byId(id: string): Promise<GeographicLocation | null> {
      const rows = await sql<Row[]>`select * from app_private.geographic_locations where identity = ${id}`
      return rows[0] ? project(rows[0]) : null
    },
    async find(query: GeographicQuery): Promise<GeographicLocation[]> {
      const rows = query.kind === 'country'
        ? await sql<Row[]>`select * from app_private.geographic_locations where kind = 'country' and country_code = ${query.country}`
        : await sql<Row[]>`select * from app_private.geographic_locations where kind = 'city' and normalized_name = ${normalizeCitySearch(query.name)} and (${query.country ?? null}::text is null or country_code = ${query.country ?? null}) order by identity`
      return rows.map(project)
    },
    async save(location: GeographicLocation): Promise<GeographicLocation> {
      await sql`insert into app_private.geographic_locations
        (identity, kind, name, normalized_name, country, country_code, latitude, longitude, west, south, east, north, provider_id, provider, attribution, obtained_at)
        values (${location.id}, ${location.kind}, ${location.name}, ${normalizeCitySearch(location.name)}, ${location.country}, ${location.countryCode}, ${location.point.latitude}, ${location.point.longitude}, ${location.bounds?.west ?? null}, ${location.bounds?.south ?? null}, ${location.bounds?.east ?? null}, ${location.bounds?.north ?? null}, ${location.providerId}, ${location.provider}, ${location.attribution}, ${location.obtainedAt})
        on conflict do nothing`
      const rows = await sql<Row[]>`select * from app_private.geographic_locations where identity = ${location.id}`
      if (!rows[0]) throw new Error('Geographic identity conflict')
      return project(rows[0])
    },
  }
}
