import { z } from 'zod'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'

export interface MapQueryParams {
  west: number
  south: number
  east: number
  north: number
  zoom?: number
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
      city: z.string().trim().min(1).max(100).optional().nullable().default(null),
      country: z.string().trim().toLowerCase().regex(/^[a-z]{2}$/).optional().nullable().default(null),
      cursor: z.string().max(500).optional(),
      limit: MAP_LIMIT_SCHEMA.optional(),
    })
    .strict()
    .safeParse({
      west: searchParams.get('west') ?? undefined,
      south: searchParams.get('south') ?? undefined,
      east: searchParams.get('east') ?? undefined,
      north: searchParams.get('north') ?? undefined,
      zoom: searchParams.get('zoom') ?? undefined,
      ...(searchParams.has('recipient') ? { recipient: searchParams.get('recipient') } : {}),
      ...(searchParams.has('fan') ? { fan: searchParams.get('fan') } : {}),
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
    city: parsed.data.city,
    country: parsed.data.country,
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
  })
}
