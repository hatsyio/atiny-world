import { z } from 'zod'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'

export interface MapQueryParams {
  west: number
  south: number
  east: number
  north: number
  zoom?: number
  recipient?: string | null
  fan?: string | null
  city?: string | null
  country?: string | null
  cursor?: string
  limit?: number
}

const coordinateSchema = (min: number, max: number) =>
  z.coerce.number().finite().min(min).max(max)

export const MAP_LIMIT_SCHEMA = z.coerce.number().int().min(1).max(50).default(20)

export function parseMapQuery(
  searchParams: URLSearchParams,
): ActionResult<MapQueryParams> {
  const parsed = z
    .object({
      west: coordinateSchema(-180, 180),
      south: coordinateSchema(-90, 90),
      east: coordinateSchema(-180, 180),
      north: coordinateSchema(-90, 90),
      zoom: coordinateSchema(0, 22).optional(),
      recipient: z
        .union([z.literal('atiny'), z.literal('ateez'), z.literal('hongjoong'), z.literal('seonghwa'), z.literal('yunho'), z.literal('yeosang'), z.literal('san'), z.literal('mingi'), z.literal('wooyoung'), z.literal('jongho'), z.literal('null')])
        .optional()
        .nullable()
        .default(null),
      fan: z.string().uuid().optional().nullable().default(null),
      city: z.string().trim().min(1).max(100).optional().nullable().default(null),
      country: z.string().trim().toLowerCase().regex(/^[a-z]{2}$/).optional().nullable().default(null),
      cursor: z.string().max(500).optional(),
      limit: MAP_LIMIT_SCHEMA.optional(),
    })
    .safeParse({
      west: searchParams.get('west') ?? undefined,
      south: searchParams.get('south') ?? undefined,
      east: searchParams.get('east') ?? undefined,
      north: searchParams.get('north') ?? undefined,
      zoom: searchParams.get('zoom') ?? undefined,
      recipient: searchParams.get('recipient') ?? undefined,
      fan: searchParams.get('fan') ?? undefined,
      city: searchParams.get('city') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

  if (!parsed.success) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
    })
  }

  return okResult({
    west: parsed.data.west,
    south: parsed.data.south,
    east: parsed.data.east,
    north: parsed.data.north,
    zoom: parsed.data.zoom,
    recipient: parsed.data.recipient,
    fan: parsed.data.fan,
    city: parsed.data.city,
    country: parsed.data.country,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
  })
}

export function parseUserSearchQuery(
  searchParams: URLSearchParams,
): ActionResult<{ q: string; cursor?: string; limit?: number }> {
  const parsed = z
    .object({
      q: z.string().min(1).max(80).refine((value) => [...value].length >= 2, {
        message: 'min 2 characters',
      }),
      cursor: z.string().max(500).optional(),
      limit: MAP_LIMIT_SCHEMA.optional(),
    })
    .safeParse({
      q: searchParams.get('q') ?? '',
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

  if (!parsed.success) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
    })
  }

  return okResult(parsed.data)
}
