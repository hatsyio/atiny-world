import type { Fragment, Sql, TransactionSql } from '@/server/db/sql'
import { parsePublicId } from '@/domain/contracts'
import { normalizeCitySearch } from '@/domain/location/city-search'

import {
  type MapBounds,
  type PublicMapFeature,
  type PublicMessageDetail,
  projectPublicFeature,
} from '@/domain/messages/public-message'

import { signCursor, verifyCursor } from './cursor'

export type { MapBounds } from '@/domain/messages/public-message'

export type MapFeature = PublicMapFeature

export interface MapFeatureOptions {
  limit?: number
  city?: string | null
  country?: string | null
}

export interface PublicMessagePage {
  items: PublicMessageDetail[]
  nextCursor: string | null
}

export interface PublicLetterPage {
  items: PublicMessageDetail[]
  page: number
  totalPages: number
}

export interface LetterCriteria {
  q?: string
  country?: string
  city?: string
  page?: number
}

/** Numbered archive pages support direct links and arbitrary page jumps. */
export async function pagePublicLetters(sql: Sql, args: LetterCriteria): Promise<PublicLetterPage> {
  return sql.begin(async tx => {
    // Count and rows must see the same publication/moderation snapshot.
    await tx`set transaction isolation level repeatable read, read only`
    const conditions = extraConditions(tx, {
      city: args.city || undefined,
      country: args.country || undefined,
    })
    if (args.q) conditions.push(tx`strpos(lower(m.content), lower(${args.q})) > 0`)
    const where = tx`${visibilityCondition(tx)} and ${joinConditions(tx, conditions)}`
    const [count] = await tx<Array<{ total: string }>>`
      select count(*) as total
        from app_private.messages m
        join app_private.profiles p on p.id = m.author_id
       where ${where}
    `
    const totalPages = Math.ceil(Number(count.total) / 20)
    const requested = Number.isSafeInteger(args.page) && args.page! > 0 ? args.page! : 1
    const page = Math.min(requested, Math.max(1, totalPages))
    const rows = await tx<FeatureRow[]>`
      select ${featureColumnsWithContent(tx, true)}
        from app_private.messages m
        join app_private.profiles p on p.id = m.author_id
       where ${where}
       order by m.published_at desc, m.id desc
       limit 20 offset ${(page - 1) * 20}
    `
    return {
      items: rows.map(row => ({ ...projectPublicFeature(row), content: row.content ?? '' })),
      page, totalPages,
    }
  })
}

export async function listPublicLetterCountries(sql: Sql): Promise<string[]> {
  const rows = await sql<Array<{ country_code: string }>>`
    select distinct m.country_code
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${visibilityCondition(sql)}
     order by m.country_code
  `
  return rows.map(row => row.country_code)
}

export interface PublicMessageStats {
  letters: number
  countries: number
}

export async function getPublicMessageStats(sql: Sql): Promise<PublicMessageStats> {
  const rows = await sql<Array<{ letters: number; countries: number }>>`
    select count(*)::int as letters, count(distinct m.country_code)::int as countries
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${visibilityCondition(sql)}
  `

  return rows[0] ?? { letters: 0, countries: 0 }
}

export async function listLatestPublicMessages(
  sql: Sql,
  limit = 4,
): Promise<PublicMessageDetail[]> {
  const rows = await sql<FeatureRow[]>`
    select ${featureColumnsWithContent(sql, true)}
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${visibilityCondition(sql)}
     order by m.published_at desc, m.id desc
     limit ${limit}
  `

  return rows.map((row) => ({
    ...projectPublicFeature(row),
    content: row.content ?? '',
  }))
}

type FeatureRow = {
  id: string
  public_id: string
  latitude: number
  longitude: number
  location_precision: string
  locality: string | null
  country: string
  country_code: string
  published_at: string | Date
  author_public_id: string
  display_name: string
  content: string | null
}

export function visibilityCondition(sql: Sql | TransactionSql): Fragment {
  return sql`
    p.account_state = 'active'
    and p.suspended_at is null
    and (
      m.status = 'approved'
      or (
        m.status = 'pending'
        and (select premoderation_enabled from app_private.settings where id = 1) = false
      )
    )
  `
}

function bboxCondition(sql: Sql, bounds: MapBounds): Fragment {
  if (bounds.west <= bounds.east) {
    return sql`ST_Intersects(
      m.public_point::geometry,
      ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}, 4326)
    )`
  }

  return sql`(
    ST_Intersects(m.public_point::geometry, ST_MakeEnvelope(${bounds.west}, ${bounds.south}, 180, ${bounds.north}, 4326))
    or ST_Intersects(m.public_point::geometry, ST_MakeEnvelope(-180, ${bounds.south}, ${bounds.east}, ${bounds.north}, 4326))
  )`
}

function extraConditions(sql: Sql | TransactionSql, options: MapFeatureOptions): Fragment[] {
  const conditions: Fragment[] = []

  if (options.city !== undefined && options.city !== null) {
    const city = normalizeCitySearch(options.city)
    // ICU keeps Unicode letters/numbers, regardless of the database's default locale.
    // Match the NFKD normalization used by selected markers in the browser.
    conditions.push(city ? sql`strpos(
      regexp_replace(lower(normalize(m.locality, NFKD) collate "und-x-icu"), '[^[:alnum:]]', '', 'g'),
      ${city}
    ) > 0` : sql`false`)
  }

  if (options.country !== undefined && options.country !== null) {
    conditions.push(sql`m.country_code = ${options.country}`)
  }

  return conditions
}

function joinConditions(sql: Sql | TransactionSql, conditions: Fragment[]): Fragment {
  if (conditions.length === 0) return sql`true`
  return conditions.slice(1).reduce((acc, condition) => {
    return sql`(${acc}) and (${condition})`
  }, conditions[0])
}

function featureColumnsWithContent(sql: Sql | TransactionSql, includeContent: boolean): Fragment {
  if (includeContent) {
    return sql`m.id as id, m.public_id, st_y(m.public_point::geometry) as latitude,
      st_x(m.public_point::geometry) as longitude, m.location_precision,
      m.locality, m.country, m.country_code, m.published_at,
      p.public_id as author_public_id, p.display_name,
      m.content`
  }
  return sql`m.id as id, m.public_id, st_y(m.public_point::geometry) as latitude,
    st_x(m.public_point::geometry) as longitude, m.location_precision,
    m.locality, m.country, m.country_code, m.published_at,
    p.public_id as author_public_id, p.display_name,
    null as content`
}

export async function listFeaturesInViewport(
  sql: Sql,
  bounds: MapBounds,
  options: MapFeatureOptions = {},
): Promise<PublicMapFeature[]> {
  const extra = extraConditions(sql, options)
  const where = sql`${visibilityCondition(sql)} and ${bboxCondition(sql, bounds)} and ${joinConditions(sql, extra)}`

  const rows = await sql<FeatureRow[]>`
    select ${featureColumnsWithContent(sql, false)}
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${where}
     order by m.published_at desc, m.id desc
     limit ${options.limit ?? 2000}
  `

  return rows.map(projectPublicFeature)
}

export async function pagePublicMessages(
  sql: Sql,
  args: {
    bounds: MapBounds
    cursor?: string
    limit?: number
    city?: string | null
    country?: string | null
  },
): Promise<PublicMessagePage> {
  const bound = args.cursor ? await verifyCursor(args.cursor) : null
  const limit = args.limit ?? 20
  const extra = extraConditions(sql, {
    city: args.city,
    country: args.country,
  })

  const cursorCondition: Fragment = bound?.publishedAt
    ? sql`
      (m.published_at < ${bound.publishedAt}
       or (m.published_at = ${bound.publishedAt} and m.id < ${bound.id}::bigint))
    `
    : sql`true`

  const where = sql`${visibilityCondition(sql)} and ${bboxCondition(sql, args.bounds)} and ${joinConditions(sql, extra)} and ${cursorCondition}`

  const rows = await sql<Array<FeatureRow & { cursor_published_at: string }>>`
    select ${featureColumnsWithContent(sql, true)},
      to_char(m.published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_published_at
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${where}
     order by m.published_at desc, m.id desc
     limit ${limit + 1}
  `

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return {
    items: page.map((row) => ({
      ...projectPublicFeature(row),
      content: row.content ?? '',
    })),
    nextCursor: hasMore && last ? await signCursor({ publishedAt: last.cursor_published_at, id: last.id }) : null,
  }
}

export async function getVisibleMessage(
  sql: Sql,
  publicId: string,
): Promise<PublicMessageDetail | null> {
  if (!parsePublicId(publicId).ok) return null

  const rows = await sql<FeatureRow[]>`
    select ${featureColumnsWithContent(sql, true)}
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where ${visibilityCondition(sql)}
       and m.public_id = ${publicId}
     limit 1
  `

  const row = rows[0]
  if (!row) return null

  return {
    ...projectPublicFeature(row),
    content: row.content ?? '',
  }
}
