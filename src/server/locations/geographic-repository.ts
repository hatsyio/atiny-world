import { cachedPublicRead, invalidateGeographicReads } from '@/server/cache'
import { z } from 'zod'
import type { Sql, TransactionSql } from '@/server/db/sql'
import type { GeographicLocation, GeographicQuery } from '@/domain/location/geographic-location'
import { visibilityCondition } from '@/server/messages/public-repository'
import { normalizeCitySearch } from '@/domain/location/city-search'

type Row = { identity: string; kind: GeographicLocation['kind']; name: string; country: string; country_code: string; latitude: number; longitude: number; west: number | null; south: number | null; east: number | null; north: number | null; provider_id: string | null; provider: 'Geoapify'; attribution: string; obtained_at: Date }
const project = (row: Row): GeographicLocation => ({ id: row.identity, kind: row.kind, name: row.name, country: row.country, countryCode: row.country_code, point: { latitude: row.latitude, longitude: row.longitude }, bounds: row.west === null ? null : { west: row.west, south: row.south!, east: row.east!, north: row.north! }, providerId: row.provider_id, provider: row.provider, attribution: row.attribution, obtainedAt: row.obtained_at.toISOString() })

/** Transaction callers bypass caching and must invalidateGeographicReads after a saved record commits. */
export function geographicRepository(sql: Sql | TransactionSql) {
  return {
    async byId(id: string): Promise<GeographicLocation | null> {
      if (!validId(id)) return null
      const load = async () => {
        const rows = await sql<Row[]>`select * from app_private.geographic_locations where identity = ${id}`
        return rows[0] ? project(rows[0]) : null
      }
      return 'begin' in sql ? cachedPublicRead('geography', ['id', id], isPersistedLocation, load) : load()
    },
    async find(query: GeographicQuery): Promise<GeographicLocation[]> {
      if (!validQuery(query)) return []
      const load = async () => {
        const rows = query.kind === 'country'
          ? await sql<Row[]>`select * from app_private.geographic_locations where kind = 'country' and country_code = ${query.country}`
          : await sql<Row[]>`select * from app_private.geographic_locations where kind = 'city' and normalized_name = ${normalizeCitySearch(query.name)} and (${query.country ?? null}::text is null or country_code = ${query.country ?? null}) order by identity`
        return rows.map(project)
      }
      return 'begin' in sql ? cachedPublicRead('geography', ['find', query.kind, query.kind === 'country' ? null : normalizeCitySearch(query.name), query.country ?? null], isLocations, load) : load()
    },
    async preferPublicCity(locations: GeographicLocation[]): Promise<GeographicLocation[]> {
      if (locations.length < 2) return locations
      // Resolve same-country homonyms using already public, approximate points.
      // Hidden letters and suspended authors must not influence navigation.
      const [preferred] = await sql<{ identity: string }[]>`
        select g.identity
          from app_private.geographic_locations g
          join app_private.messages m on m.country_code = g.country_code
            and regexp_replace(lower(normalize(m.locality, NFKD) collate "und-x-icu"), '[^[:alnum:]]', '', 'g') = g.normalized_name
          join app_private.profiles p on p.id = m.author_id
         where g.identity = any(${locations.map(location => location.id)}::text[])
           and g.kind = 'city' and ${visibilityCondition(sql)}
         group by g.identity
         order by min(ST_Distance(m.public_point, ST_SetSRID(ST_MakePoint(g.longitude, g.latitude), 4326)::geography)), g.identity
         limit 1`
      if (!preferred) return locations
      return [...locations.filter(location => location.id === preferred.identity), ...locations.filter(location => location.id !== preferred.identity)]
    },
    async save(location: GeographicLocation): Promise<GeographicLocation> {
      await sql`insert into app_private.geographic_locations
        (identity, kind, name, normalized_name, country, country_code, latitude, longitude, west, south, east, north, provider_id, provider, attribution, obtained_at)
        values (${location.id}, ${location.kind}, ${location.name}, ${normalizeCitySearch(location.name)}, ${location.country}, ${location.countryCode}, ${location.point.latitude}, ${location.point.longitude}, ${location.bounds?.west ?? null}, ${location.bounds?.south ?? null}, ${location.bounds?.east ?? null}, ${location.bounds?.north ?? null}, ${location.providerId}, ${location.provider}, ${location.attribution}, ${location.obtainedAt})
        on conflict do nothing`
      const rows = await sql<Row[]>`select * from app_private.geographic_locations where identity = ${location.id}`
      if (!rows[0]) throw new Error('Geographic identity conflict')
      const saved = project(rows[0])
      // A TransactionSql caller owns its commit: never publish or invalidate here.
      if ('begin' in sql) await invalidateGeographicReads()
      return saved
    },
  }
}

const coordinate = (min: number, max: number) => z.number().finite().min(min).max(max)
const locationSchema = z.object({
  id: z.string().min(1).max(1500), kind: z.enum(['country', 'city']), name: z.string().min(1), country: z.string().min(1), countryCode: z.string().regex(/^[a-z]{2}$/),
  point: z.object({ latitude: coordinate(-90, 90), longitude: coordinate(-180, 180) }),
  bounds: z.object({ west: coordinate(-180, 180), south: coordinate(-90, 90), east: coordinate(-180, 180), north: coordinate(-90, 90) }).refine(bounds => bounds.west < bounds.east && bounds.south < bounds.north).nullable(),
  providerId: z.string().nullable(), provider: z.literal('Geoapify'), attribution: z.string(), obtainedAt: z.iso.datetime(),
})
const isPersistedLocation = (value: unknown): value is GeographicLocation | null => value !== null && locationSchema.safeParse(value).success
const isLocations = (value: unknown): value is GeographicLocation[] => Array.isArray(value) && value.every(item => locationSchema.safeParse(item).success)
const validId = (id: string) => typeof id === 'string' && id.length <= 1500 && (/^country:[a-z]{2}$/.test(id) || /^city:[^\s]+$/.test(id))
function validQuery(query: GeographicQuery): boolean {
  return (query.kind === 'city' || query.kind === 'country') && typeof query.name === 'string' && query.name.trim().length > 0 && query.name.length <= 100
    && (query.country === undefined || /^[a-z]{2}$/.test(query.country))
    && (query.kind === 'country' ? Boolean(query.country) : Boolean(normalizeCitySearch(query.name)))
}
