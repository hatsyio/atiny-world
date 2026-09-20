import type { Fragment, Sql } from 'postgres'

import {
  type MapBounds,
  type PublicMapFeature,
  type PublicMessageDetail,
  type PublicUser,
  projectPublicFeature,
} from '@/domain/messages/public-message'

import { signCursor, verifyCursor } from './cursor'

export type { MapBounds } from '@/domain/messages/public-message'

export type MapFeature = PublicMapFeature

export interface MapFeatureOptions {
  limit?: number
  recipient?: string | null
  fan?: string | null
  city?: string | null
  country?: string | null
}

export interface PublicMessagePage {
  items: PublicMessageDetail[]
  nextCursor: string | null
}

export interface PublicUserPage {
  items: PublicUser[]
  nextCursor: string | null
}

type FeatureRow = {
  id: string
  public_id: string
  latitude: number
  longitude: number
  location_precision: string
  locality: string | null
  country: string
  recipient: string | null
  published_at: string
  author_public_id: string
  username: string
  display_name: string
  content: string | null
}

function visibilityCondition(sql: Sql): Fragment {
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

function extraConditions(sql: Sql, options: MapFeatureOptions): Fragment[] {
  const conditions: Fragment[] = []

  if (options.recipient !== undefined && options.recipient !== null) {
    if (options.recipient === 'null') {
      conditions.push(sql`m.recipient is null`)
    } else {
      conditions.push(sql`m.recipient = ${options.recipient}`)
    }
  }

  if (options.fan !== undefined && options.fan !== null) {
    conditions.push(sql`p.public_id = ${options.fan}`)
  }

  if (options.city !== undefined && options.city !== null) {
    conditions.push(sql`lower(m.locality) = lower(${options.city})`)
  }

  if (options.country !== undefined && options.country !== null) {
    conditions.push(sql`m.country_code = ${options.country}`)
  }

  return conditions
}

function joinConditions(sql: Sql, conditions: Fragment[]): Fragment {
  if (conditions.length === 0) return sql`true`
  return conditions.slice(1).reduce((acc, condition) => {
    return sql`(${acc}) and (${condition})`
  }, conditions[0])
}

function featureColumnsWithContent(sql: Sql, includeContent: boolean): Fragment {
  if (includeContent) {
    return sql`m.id as id, m.public_id, st_y(m.public_point::geometry) as latitude,
      st_x(m.public_point::geometry) as longitude, m.location_precision,
      m.locality, m.country, m.recipient, m.published_at,
      p.public_id as author_public_id, p.username, p.display_name,
      m.content`
  }
  return sql`m.id as id, m.public_id, st_y(m.public_point::geometry) as latitude,
    st_x(m.public_point::geometry) as longitude, m.location_precision,
    m.locality, m.country, m.recipient, m.published_at,
    p.public_id as author_public_id, p.username, p.display_name,
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
    recipient?: string | null
    fan?: string | null
    city?: string | null
    country?: string | null
  },
): Promise<PublicMessagePage> {
  const bound = args.cursor ? verifyCursor(args.cursor) : null
  const limit = args.limit ?? 20
  const extra = extraConditions(sql, {
    recipient: args.recipient,
      fan: args.fan,
      city: args.city,
      country: args.country,
  })

  const cursorCondition: Fragment = bound
    ? sql`
      (m.published_at < ${bound.publishedAt!}
       or (m.published_at = ${bound.publishedAt!} and m.id < ${bound.id}::bigint))
    `
    : sql`true`

  const where = sql`${visibilityCondition(sql)} and ${bboxCondition(sql, args.bounds)} and ${joinConditions(sql, extra)} and ${cursorCondition}`

  const rows = await sql<FeatureRow[]>`
    select ${featureColumnsWithContent(sql, true)}
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
    nextCursor: hasMore && last ? signCursor({ publishedAt: last.published_at, id: last.id }) : null,
  }
}

export async function getVisibleMessage(
  sql: Sql,
  publicId: string,
): Promise<PublicMessageDetail | null> {
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

export async function searchPublicUsers(
  sql: Sql,
  args: { query: string; cursor?: string; limit?: number },
): Promise<PublicUserPage> {
  const bound = args.cursor ? verifyCursor(args.cursor) : null
  const limit = args.limit ?? 20
  const pattern = `%${args.query}%`

  const cursorCondition = bound
    ? sql`p.id > ${bound.id}::bigint`
    : sql`true`

  const rows = await sql<{ id: string; public_id: string; username: string; display_name: string }[]>`
    select p.id, p.public_id, p.username, p.display_name
      from app_private.profiles p
     where p.account_state = 'active'
       and p.suspended_at is null
       and (p.username_normalized ilike ${pattern} or p.display_name ilike ${pattern})
       and ${cursorCondition}
     order by p.id asc
     limit ${limit + 1}
  `

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return {
    items: page.map((row) => ({
      publicId: row.public_id,
      username: row.username,
      displayName: row.display_name,
    })),
    nextCursor: hasMore && last ? signCursor({ id: last.id }) : null,
  }
}
