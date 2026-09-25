import type { Fragment, Sql } from 'postgres'

import {
  projectOwnMessage,
  type OwnMessage,
} from '@/domain/messages/own-message'
import { signCursor, verifyCursor } from './cursor'

export type { OwnMessage } from '@/domain/messages/own-message'

export interface OwnMessagePage {
  items: OwnMessage[]
  nextCursor: string | null
}

type OwnMessageRow = {
  id: string
  public_id: string
  version: number
  status: string
  moderation_reason_code: string | null
  moderation_note: string | null
  content: string
  recipient: string | null
  latitude: number
  longitude: number
  location_precision: string
  locality: string | null
  country: string
  created_at: string
  published_at: string
}

// Por unidad de cuenta el límite y el cooldown mantienen el volumen en el rango
// de decenas, así que el orden por `id desc` (creación) consume una sola pasada
// del índice y el cursor se limita a la clave exacta de persistencia sin
// depender de la precisión de fechas. Reutiliza la mismísima forma de cursor
// que `searchPublicUsers`/`pagePublicUsers`.
export async function pageOwnMessages(
  sql: Sql,
  args: { clerkUserId: string; cursor?: string; limit?: number },
): Promise<OwnMessagePage> {
  const bound = args.cursor ? verifyCursor(args.cursor) : null
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)

  const cursorCondition: Fragment = bound
    ? sql`m.id < ${bound.id}::bigint`
    : sql`true`

  const rows = await sql<OwnMessageRow[]>`
    select m.id, m.public_id, m.version, m.status, m.moderation_reason_code,
           m.moderation_note, m.content, m.recipient,
           st_y(m.public_point::geometry) as latitude,
           st_x(m.public_point::geometry) as longitude,
           m.location_precision, m.locality, m.country,
           m.created_at, m.published_at
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where p.clerk_user_id = ${args.clerkUserId}
       and ${cursorCondition}
     order by m.id desc
     limit ${limit + 1}
  `

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return {
    items: page.map(projectOwnMessage),
    nextCursor: hasMore && last ? signCursor({ id: last.id }) : null,
  }
}
