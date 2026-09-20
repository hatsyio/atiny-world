import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createMessageForSession } from '../../src/server/actions/create-message'
import {
  signLocationSelection,
  verifyLocationSelectionResult,
  type LocationSelection,
} from '../../src/server/locations/selection-token'
import {
  createTestDb,
  insertMessage,
  insertProfile,
  truncateProductTables,
} from '../support/database'

const db = createTestDb()

const SECRET = 'integration-test-secret'
const ISSUED_AT = new Date('2026-09-20T12:00:00Z')
const SELECTION: LocationSelection = {
  locality: 'Seoul',
  country: 'South Korea',
  countryCode: 'kr',
  point: { latitude: 37.5665, longitude: 126.978 },
  attribution: 'Geoapify',
}

function deps(clerkUserId: string) {
  return {
    readAuth: async () => ({ clerkUserId }),
    verifySelection: (token: string) =>
      verifyLocationSelectionResult(token, SECRET, ISSUED_AT),
  }
}

const validSelectionId = () => signLocationSelection(SELECTION, SECRET, ISSUED_AT)

type StoredMessage = {
  public_id: string
  version: number
  content: string
  recipient: string | null
  status: string
  location_precision: string
  location_algorithm_version: number | null
  country: string
  country_code: string
  latitude: number
  longitude: number
}

async function storedMessage(authorId: string): Promise<StoredMessage> {
  const rows = await db<StoredMessage[]>`
    select public_id, version, content, recipient, status, location_precision,
           location_algorithm_version, country, country_code,
           ST_Y(public_point::geometry) as latitude,
           ST_X(public_point::geometry) as longitude
      from app_private.messages
     where author_id = ${authorId}
  `
  return rows[0]
}

beforeEach(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set message_limit = 10, cooldown_seconds = 10 where id = 1`
})

afterAll(async () => {
  await truncateProductTables(db)
  await db.end()
})

describe('createMessage server action', () => {
  it('publishes an approximate pending message with the stable link from the selection token', async () => {
    const profile = await insertProfile(db, 'action-approximate')
    const result = await createMessageForSession(db, {
      content: 'Siempre contigo',
      recipient: 'ateez',
      location: { selectionId: validSelectionId(), precision: 'approximate' },
    }, deps('action-approximate'))

    expect(result).toMatchObject({
      ok: true,
      data: { publicId: expect.any(String), version: 1, status: 'pending' },
    })
    const message = await storedMessage(profile.id)
    expect(message).toMatchObject({
      public_id: result.ok ? result.data.publicId : '',
      version: 1,
      content: 'Siempre contigo',
      recipient: 'ateez',
      status: 'pending',
      location_precision: 'approximate',
      location_algorithm_version: 1,
      country: 'South Korea',
      country_code: 'kr',
    })
    expect(message.latitude).not.toBe(SELECTION.point.latitude)
    expect(message.longitude).not.toBe(SELECTION.point.longitude)
  })

  it('publishes the explicitly confirmed precise point without the typed address', async () => {
    const profile = await insertProfile(db, 'action-precise')
    const confirmedPublicPoint = { latitude: 37.57, longitude: 126.99 }
    const result = await createMessageForSession(db, {
      content: 'Estoy aquí',
      recipient: null,
      location: {
        selectionId: validSelectionId(),
        precision: 'precise',
        confirmedPublicPoint,
        preciseLocationConfirmed: true,
      },
    }, deps('action-precise'))

    expect(result).toMatchObject({ ok: true, data: { status: 'pending' } })
    const message = await storedMessage(profile.id)
    expect(message).toMatchObject({
      version: 1,
      recipient: null,
      status: 'pending',
      location_precision: 'precise',
      location_algorithm_version: null,
      country: 'South Korea',
      country_code: 'kr',
    })
    expect(message.latitude).toBeCloseTo(confirmedPublicPoint.latitude, 10)
    expect(message.longitude).toBeCloseTo(confirmedPublicPoint.longitude, 10)
    expect(Object.keys(message)).not.toContain('selection_token')
    expect(Object.keys(message)).not.toContain('address')
  })

  it('rejects a suspended account', async () => {
    await insertProfile(db, 'action-suspended', {
      suspended_at: '2026-09-01T00:00:00Z',
      suspension_reason_code: 'conduct',
    })
    const result = await createMessageForSession(db, {
      content: 'Sin permiso',
      recipient: null,
      location: { selectionId: validSelectionId(), precision: 'approximate' },
    }, deps('action-suspended'))

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_SUSPENDED', messageKey: 'account.suspended' },
    })
  })

  it('enforces the ten-message limit through the action', async () => {
    const profile = await insertProfile(db, 'action-limit')
    await db`update app_private.settings set cooldown_seconds = 0 where id = 1`
    for (let index = 0; index < 10; index += 1) {
      await insertMessage(db, profile.id, { status: 'pending' })
    }

    const result = await createMessageForSession(db, {
      content: 'El undécimo mensaje',
      recipient: 'atiny',
      location: { selectionId: validSelectionId(), precision: 'approximate' },
    }, deps('action-limit'))

    expect(result).toEqual({
      ok: false,
      error: { code: 'MESSAGE_LIMIT_REACHED', messageKey: 'message.limitReached' },
    })
  })

  it('enforces the cooldown with database seconds', async () => {
    const profile = await insertProfile(db, 'action-cooldown')
    await insertMessage(db, profile.id, { status: 'pending' })

    const result = await createMessageForSession(db, {
      content: 'Demasiado pronto',
      recipient: null,
      location: { selectionId: validSelectionId(), precision: 'approximate' },
    }, deps('action-cooldown'))

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'MESSAGE_COOLDOWN_ACTIVE', messageKey: 'message.cooldown', retryAfterSeconds: expect.any(Number) },
    })
  })
})