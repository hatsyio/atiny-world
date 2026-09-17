import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createMessage } from '../../src/server/messages/create-message'
import {
  createSecondConnection,
  createTestDb,
  insertMessage,
  insertProfile,
  truncateProductTables,
} from '../support/database'

const db = createTestDb()
const other = createSecondConnection()

beforeEach(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set message_limit = 10, cooldown_seconds = 10 where id = 1`
})

afterAll(async () => {
  await truncateProductTables(db)
  await Promise.all([db.end(), other.end()])
})

describe('createMessage concurrency', () => {
  it('counts every non-deleted state and never permits an eleventh concurrent message', async () => {
    const profile = await insertProfile(db, 'publish-limit')
    for (let index = 0; index < 9; index += 1) {
      await insertMessage(db, profile.id, {
        status: index % 2 ? 'rejected' : 'withdrawn',
        moderation_reason_code: 'fixture',
      })
    }
    await db`update app_private.settings set cooldown_seconds = 0 where id = 1`

    const input = {
      clerkUserId: 'publish-limit',
      content: 'Un mensaje válido',
      recipient: 'ateez' as const,
      location: { precision: 'approximate' as const, localityCenter: { latitude: 40.4, longitude: -3.7 }, country: 'España', countryCode: 'es' },
    }
    const [first, second] = await Promise.all([
      createMessage(db, input),
      createMessage(other, input),
    ])

    expect([first, second].filter((result) => result.ok)).toHaveLength(1)
    expect([first, second].find((result) => !result.ok)).toMatchObject({ error: { code: 'MESSAGE_LIMIT_REACHED' } })
  })

  it('uses database time for cooldown and never calls an external provider inside the transaction', async () => {
    const profile = await insertProfile(db, 'publish-cooldown')
    await insertMessage(db, profile.id, { status: 'pending' })

    const result = await createMessage(db, {
      clerkUserId: 'publish-cooldown',
      content: 'Otro mensaje válido',
      recipient: 'atiny',
      location: { precision: 'approximate', localityCenter: { latitude: 40.4, longitude: -3.7 }, country: 'España', countryCode: 'es' },
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'MESSAGE_COOLDOWN_ACTIVE', retryAfterSeconds: expect.any(Number) } })
  })
})
