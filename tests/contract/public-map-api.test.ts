import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET as getMessage } from '../../src/app/api/messages/[publicId]/route'
import { createMapFeaturesGetHandler, GET as getFeatures } from '../../src/app/api/map/features/route'
import { GET as getMessages } from '../../src/app/api/map/messages/route'
import { GET as searchUsers } from '../../src/app/api/users/search/route'
import { getDb } from '../../src/server/db/client'

const db = getDb()

const CONTRACT_FIXTURE_CLERK = 'contract-public-map'
const ABSENT_PUBLIC_ID = '00000000-0000-4000-8000-000000000000'

type Json = Record<string, unknown>

function apiUrl(
  path: string,
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params).toString()
  return `http://localhost${path}${query ? `?${query}` : ''}`
}

async function insertFixtureMessage(
  overrides: {
    status: string
    latitude: number
    longitude: number
    recipient?: string
    premoderationOff?: boolean
  },
): Promise<{ publicId: string; authorId: string }> {
  const profileRows = await db<{ id: string }[]>`
    select id from app_private.profiles
     where clerk_user_id = ${CONTRACT_FIXTURE_CLERK}
     limit 1
  `
  const authorId = profileRows[0].id
  const moderationReason =
    overrides.status === 'rejected' ? 'offensive' : null

  const rows = await db<{ public_id: string }[]>`
    insert into app_private.messages (
      author_id, content, recipient, status, moderation_reason_code,
      location_precision, location_algorithm_version, public_point, locality, country, country_code
    ) values (
      ${authorId}, 'Mensaje de contrato', ${overrides.recipient ?? 'atiny'},
      ${overrides.status}, ${moderationReason}, 'approximate', 1,
      ST_SetSRID(ST_MakePoint(${overrides.longitude}, ${overrides.latitude}), 4326)::geography,
      'Testloc', 'España', 'es'
    )
    returning public_id
  `

  return { publicId: rows[0].public_id, authorId }
}

describe('GET /api/map/features', () => {
  it('rejects out-of-range bbox coordinates with 400', async () => {
    const response = await getFeatures(
      new Request(
        apiUrl('/api/map/features', {
          west: '-190',
          south: '35',
          east: '5',
          north: '45',
          zoom: '5',
        }),
      ),
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as Json
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns only minimum public fields and no-store caching', async () => {
    const response = await getFeatures(
      new Request(
        apiUrl('/api/map/features', {
          west: '-10',
          south: '35',
          east: '5',
          north: '45',
          zoom: '5',
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')

    const body = (await response.json()) as {
      features: Array<Record<string, unknown>>
      truncated: boolean
    }
    expect(typeof body.truncated).toBe('boolean')
    expect(Array.isArray(body.features)).toBe(true)

    for (const feature of body.features) {
      expect(feature).toHaveProperty('publicId')
      expect(feature).toHaveProperty('point')
      expect(feature).toHaveProperty('precision')
      expect(feature).toHaveProperty('locality')
      expect(feature).toHaveProperty('country')
      expect(feature).toHaveProperty('recipient')
      expect(feature).toHaveProperty('publishedAt')
      expect(feature).toHaveProperty('author')
      expect(feature).not.toHaveProperty('content')
      expect(feature).not.toHaveProperty('status')
      expect(feature).not.toHaveProperty('moderationReasonCode')
    }
  })

  it('accepts an antimeridian-crossing bbox without failure', async () => {
    const response = await getFeatures(
      new Request(
        apiUrl('/api/map/features', {
          west: '170',
          south: '30',
          east: '-170',
          north: '60',
          zoom: '3',
        }),
      ),
    )

    expect(response.status).toBe(200)
  })

  it('serves the full world bbox with a healthy database', async () => {
    const response = await getFeatures(
      new Request(
        apiUrl('/api/map/features', {
          west: '-180',
          south: '-90',
          east: '180',
          north: '90',
        }),
      ),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      features: Array<Record<string, unknown>>
      truncated: boolean
    }
    expect(typeof body.truncated).toBe('boolean')
    expect(Array.isArray(body.features)).toBe(true)
  })

  it('keeps a controlled error when the database is unavailable', async () => {
    const handler = createMapFeaturesGetHandler({
      list: async () => {
        throw new Error('connection to localhost:54322 refused')
      },
    })

    const response = await handler(
      new Request(
        apiUrl('/api/map/features', {
          west: '-180',
          south: '-90',
          east: '180',
          north: '90',
        }),
      ),
    )

    expect(response.status).toBe(503)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.code).toBe('MAP_DATA_UNAVAILABLE')
    expect(body.messageKey).toBe('map.dataUnavailable')
    expect(JSON.stringify(body)).not.toMatch(/localhost|54322|refused|connection/i)
  })
})

describe('GET /api/map/messages', () => {
  it('paginates the visible group with stable cursor order', async () => {
    const base = {
      west: '-10',
      south: '35',
      east: '5',
      north: '45',
    }
    const first = await getMessages(
      new Request(apiUrl('/api/map/messages', { ...base, limit: '2' })),
    )

    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')

    const page1 = (await first.json()) as {
      items: Array<{ publicId: string; publishedAt: string }>
      nextCursor: string | null
    }
    expect(page1.items.length).toBeLessThanOrEqual(2)
    expect(typeof page1.nextCursor).toBe('string')

    const second = await getMessages(
      new Request(
        apiUrl('/api/map/messages', {
          ...base,
          limit: '2',
          cursor: page1.nextCursor ?? '',
        }),
      ),
    )
    expect(second.status).toBe(200)

    const page2 = (await second.json()) as { items: Array<{ publicId: string }> }
    const seen = new Set(page1.items.map((item) => item.publicId))
    for (const item of page2.items) {
      expect(seen.has(item.publicId)).toBe(false)
    }
  })

  it('rejects a malformed cursor as invalid', async () => {
    const response = await getMessages(
      new Request(
        apiUrl('/api/map/messages', {
          west: '-10',
          south: '35',
          east: '5',
          north: '45',
          cursor: 'tampered.cursor',
        }),
      ),
    )

    expect(response.status).toBe(400)
  })

  it('rejects limits above 50', async () => {
    const response = await getMessages(
      new Request(
        apiUrl('/api/map/messages', {
          west: '-10',
          south: '35',
          east: '5',
          north: '45',
          limit: '51',
        }),
      ),
    )

    expect(response.status).toBe(400)
  })

  it('serves the full world bbox with a healthy database', async () => {
    const response = await getMessages(
      new Request(
        apiUrl('/api/map/messages', {
          west: '-180',
          south: '-90',
          east: '180',
          north: '90',
          limit: '20',
        }),
      ),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { items: Array<Record<string, unknown>> }
    expect(Array.isArray(body.items)).toBe(true)
  })
})

describe('GET /api/messages/{publicId}', () => {
  it('returns a visible message with full content and no-store', async () => {
    const { publicId } = await insertFixtureMessage({
      status: 'approved',
      latitude: 40.4,
      longitude: -3.7,
    })

    const response = await getMessage(
      new Request(apiUrl(`/api/messages/${publicId}`)),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')

    const body = (await response.json()) as Json
    expect(body).toHaveProperty('content')
    expect(body).toHaveProperty('author')
  })

  it('is indistinguishable between hidden and absent messages', async () => {
    const { publicId } = await insertFixtureMessage({
      status: 'rejected',
      latitude: 40.41,
      longitude: -3.71,
    })

    const hidden = await getMessage(
      new Request(apiUrl(`/api/messages/${publicId}`)),
    )
    const absent = await getMessage(
      new Request(apiUrl(`/api/messages/${ABSENT_PUBLIC_ID}`)),
    )

    expect(hidden.status).toBe(404)
    expect(absent.status).toBe(404)
    expect(await hidden.json()).toEqual(await absent.json())
  })
})

describe('GET /api/users/search', () => {
  it('rejects queries under 2 characters', async () => {
    const response = await searchUsers(
      new Request(apiUrl('/api/users/search', { q: 'a' })),
    )

    expect(response.status).toBe(400)
    const body = (await response.json()) as Json
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns only public identity fields', async () => {
    const response = await searchUsers(
      new Request(apiUrl('/api/users/search', { q: 'cartapublic' })),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>
      nextCursor: string | null
    }
    expect(Array.isArray(body.items)).toBe(true)
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        'displayName',
        'publicId',
        'username',
      ])
    }
  })
})

beforeAll(async () => {
  await db`
    insert into app_private.profiles (
      clerk_user_id, username, username_normalized, display_name
    ) values (
      ${CONTRACT_FIXTURE_CLERK}, 'cartapublic', 'cartapublic', 'Contrato Público'
    )
    on conflict (clerk_user_id) do nothing
  `

  for (const [index] of ['a', 'b', 'c'].entries()) {
    await insertFixtureMessage({
      status: 'approved',
      latitude: 40.4 + index * 0.01,
      longitude: -3.7 - index * 0.01,
    })
  }
})

afterAll(async () => {
  const authorRows = await db<{ id: string }[]>`
    select id from app_private.profiles
     where clerk_user_id = ${CONTRACT_FIXTURE_CLERK}
     limit 1
  `
  if (authorRows[0]) {
    await db`delete from app_private.messages where author_id = ${authorRows[0].id}`
    await db`delete from app_private.profiles where id = ${authorRows[0].id}`
  }
  await db.end()
})