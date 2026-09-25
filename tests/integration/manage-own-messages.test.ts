import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createMessage } from '../../src/server/messages/create-message'
import { deleteMessage } from '../../src/server/messages/delete-message'
import { updateMessage } from '../../src/server/messages/update-message'
import {
  createTestDb,
  insertMessage,
  insertProfile,
  truncateProductTables,
} from '../support/database'

const db = createTestDb()

type StoredMessage = {
  public_id: string
  author_id: string
  version: number
  content: string
  recipient: string | null
  status: string
  moderation_reason_code: string | null
  moderation_note: string | null
  location_precision: string
  location_algorithm_version: number | null
  locality: string | null
  country: string
  country_code: string
  latitude: number
  longitude: number
}

async function storedMessage(publicId: string): Promise<StoredMessage | undefined> {
  const rows = await db<StoredMessage[]>`
    select public_id, author_id, version, content, recipient, status,
           moderation_reason_code, moderation_note, location_precision,
           location_algorithm_version, locality, country, country_code,
           ST_Y(public_point::geometry) as latitude,
           ST_X(public_point::geometry) as longitude
      from app_private.messages
     where public_id = ${publicId}
  `
  return rows[0]
}

async function messageCount(publicId: string): Promise<number> {
  const rows = await db<{ count: string }[]>`
    select count(*)::text as count from app_private.messages where public_id = ${publicId}
  `
  return Number(rows[0].count)
}

beforeEach(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set message_limit = 10, cooldown_seconds = 10 where id = 1`
})

afterAll(async () => {
  await truncateProductTables(db)
  await db.end()
})

describe('updateMessage owner-only access', () => {
  it('rejects a foreign fan and an administrator without modifying the message', async () => {
    const author = await insertProfile(db, 'edit-author')
    const message = await insertMessage(db, author.id, { status: 'approved' })
    await insertProfile(db, 'edit-foreign')
    await insertProfile(db, 'edit-admin', { role: 'admin' })

    for (const clerkUserId of ['edit-foreign', 'edit-admin']) {
      const result = await updateMessage(db, {
        clerkUserId,
        publicId: message.public_id,
        expectedVersion: message.version,
        content: 'Reescritura ajena',
      })
      expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    }

    const stored = await storedMessage(message.public_id)
    expect(stored).toMatchObject({
      content: 'Un mensaje de prueba',
      status: 'approved',
      version: message.version,
    })
  })
})

describe('updateMessage expectedVersion conflicts', () => {
  it('rejects a stale expectedVersion without changing content, state or version', async () => {
    const profile = await insertProfile(db, 'edit-stale-owner')
    const message = await insertMessage(db, profile.id, { status: 'approved' })

    const result = await updateMessage(db, {
      clerkUserId: 'edit-stale-owner',
      publicId: message.public_id,
      expectedVersion: message.version + 7,
      content: 'No debe aplicarse',
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    expect(await storedMessage(message.public_id)).toMatchObject({
      content: 'Un mensaje de prueba',
      status: 'approved',
      version: message.version,
    })
  })
})

describe('updateMessage state transitions', () => {
  it('returns every state to pending with an incremented version and clears the moderation reason', async () => {
    for (const status of ['pending', 'approved', 'rejected', 'withdrawn'] as const) {
      const clerkUserId = `edit-state-${status}`
      const profile = await insertProfile(db, clerkUserId)
      const hidden = status === 'rejected' || status === 'withdrawn'
      const message = await insertMessage(db, profile.id, {
        status,
        version: 2,
        moderation_reason_code: hidden ? 'fixture' : null,
        moderation_note: hidden ? 'Nota privada' : null,
      })

      const result = await updateMessage(db, {
        clerkUserId,
        publicId: message.public_id,
        expectedVersion: message.version,
        content: 'Contenido reescrito',
      })

      expect(result).toMatchObject({ ok: true, data: { version: 3, status: 'pending' } })
      expect(await storedMessage(message.public_id)).toMatchObject({
        content: 'Contenido reescrito',
        status: 'pending',
        version: 3,
        moderation_reason_code: null,
        moderation_note: null,
      })
    }
  })
})

describe('updateMessage point preservation and replacement', () => {
  it('preserves the exact point, recipient and stable link on a text-only edit', async () => {
    const profile = await insertProfile(db, 'edit-text-owner')
    const message = await insertMessage(db, profile.id, {
      status: 'approved',
      recipient: 'atiny',
      location_precision: 'precise',
      location_algorithm_version: null,
      latitude: 37.5665,
      longitude: 126.978,
    })

    const result = await updateMessage(db, {
      clerkUserId: 'edit-text-owner',
      publicId: message.public_id,
      expectedVersion: message.version,
      content: 'Texto corregido',
    })

    expect(result).toMatchObject({
      ok: true,
      data: { publicId: message.public_id, version: message.version + 1, status: 'pending' },
    })
    expect(await messageCount(message.public_id)).toBe(1)
    const stored = await storedMessage(message.public_id)
    expect(stored).toMatchObject({
      public_id: message.public_id,
      content: 'Texto corregido',
      recipient: 'atiny',
      status: 'pending',
      version: message.version + 1,
      location_precision: 'precise',
    })
    expect(stored!.latitude).toBeCloseTo(37.5665, 10)
    expect(stored!.longitude).toBeCloseTo(126.978, 10)
  })

  it('replaces the point when the location is explicitly changed and keeps the stable link', async () => {
    const profile = await insertProfile(db, 'edit-point-owner')
    const message = await insertMessage(db, profile.id, {
      location_precision: 'precise',
      location_algorithm_version: null,
      latitude: 37.5665,
      longitude: 126.978,
    })

    const result = await updateMessage(db, {
      clerkUserId: 'edit-point-owner',
      publicId: message.public_id,
      expectedVersion: message.version,
      content: 'Nueva ubicación',
      location: {
        precision: 'precise',
        localityCenter: { latitude: 35.1796, longitude: 129.0756 },
        country: 'South Korea',
        countryCode: 'kr',
        confirmed: true,
      },
    })

    expect(result).toMatchObject({ ok: true, data: { publicId: message.public_id } })
    const stored = await storedMessage(message.public_id)
    expect(stored).toMatchObject({
      public_id: message.public_id,
      status: 'pending',
      version: message.version + 1,
      location_precision: 'precise',
    })
    expect(stored!.latitude).toBeCloseTo(35.1796, 10)
    expect(stored!.longitude).toBeCloseTo(129.0756, 10)
  })
})

describe('deleteMessage physical deletion', () => {
  it('physically deletes the owned message after confirmation', async () => {
    const profile = await insertProfile(db, 'delete-owner')
    const message = await insertMessage(db, profile.id)

    const result = await deleteMessage(db, {
      clerkUserId: 'delete-owner',
      publicId: message.public_id,
      expectedVersion: message.version,
      confirmation: true,
    })

    expect(result).toMatchObject({ ok: true, data: { deleted: true } })
    expect(await messageCount(message.public_id)).toBe(0)
  })

  it('rejects a stale expectedVersion and leaves the message available', async () => {
    const profile = await insertProfile(db, 'delete-stale-owner')
    const message = await insertMessage(db, profile.id)

    const result = await deleteMessage(db, {
      clerkUserId: 'delete-stale-owner',
      publicId: message.public_id,
      expectedVersion: message.version + 1,
      confirmation: true,
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT' } })
    expect(await messageCount(message.public_id)).toBe(1)
  })

  it('allows the owner to delete while suspended', async () => {
    const profile = await insertProfile(db, 'delete-suspended', {
      suspended_at: '2026-09-01T00:00:00Z',
      suspension_reason_code: 'conduct',
    })
    const message = await insertMessage(db, profile.id)

    const result = await deleteMessage(db, {
      clerkUserId: 'delete-suspended',
      publicId: message.public_id,
      expectedVersion: message.version,
      confirmation: true,
    })

    expect(result).toMatchObject({ ok: true, data: { deleted: true } })
    expect(await messageCount(message.public_id)).toBe(0)
  })
})

describe('deleteMessage ownership, released slot and cooldown timestamp', () => {
  it('rejects a foreign fan and an administrator leaving the message untouched', async () => {
    const author = await insertProfile(db, 'delete-author')
    const message = await insertMessage(db, author.id, { status: 'approved' })
    await insertProfile(db, 'delete-foreign')
    await insertProfile(db, 'delete-admin', { role: 'admin' })

    for (const clerkUserId of ['delete-foreign', 'delete-admin']) {
      const result = await deleteMessage(db, {
        clerkUserId,
        publicId: message.public_id,
        expectedVersion: message.version,
        confirmation: true,
      })
      expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    }

    expect(await messageCount(message.public_id)).toBe(1)
    expect(await storedMessage(message.public_id)).toMatchObject({
      content: 'Un mensaje de prueba',
      status: 'approved',
    })
  })

  it('releases an account slot so a new creation succeeds at the limit', async () => {
    await db`update app_private.settings set message_limit = 2, cooldown_seconds = 0 where id = 1`
    const profile = await insertProfile(db, 'delete-slot')
    await insertMessage(db, profile.id, { status: 'approved' })
    const toDelete = await insertMessage(db, profile.id, {
      status: 'rejected',
      moderation_reason_code: 'fixture',
    })

    const blocked = await createMessage(db, {
      clerkUserId: 'delete-slot',
      content: 'No cabe hasta eliminar',
      recipient: 'ateez',
      location: {
        precision: 'approximate',
        localityCenter: { latitude: 40.4168, longitude: -3.7038 },
        country: 'España',
        countryCode: 'es',
      },
    })
    expect(blocked).toMatchObject({ ok: false, error: { code: 'MESSAGE_LIMIT_REACHED' } })

    const deleted = await deleteMessage(db, {
      clerkUserId: 'delete-slot',
      publicId: toDelete.public_id,
      expectedVersion: toDelete.version,
      confirmation: true,
    })
    expect(deleted).toMatchObject({ ok: true, data: { deleted: true } })

    const created = await createMessage(db, {
      clerkUserId: 'delete-slot',
      content: 'Ahora sí cabe',
      recipient: 'ateez',
      location: {
        precision: 'approximate',
        localityCenter: { latitude: 40.4168, longitude: -3.7038 },
        country: 'España',
        countryCode: 'es',
      },
    })
    expect(created).toMatchObject({ ok: true })
  })

  it('leaves the cooldown timestamp unchanged when deleting', async () => {
    const profile = await insertProfile(db, 'delete-cooldown')
    await db`update app_private.profiles set last_message_created_at = '2026-09-20T08:00:00Z' where id = ${profile.id}`
    const message = await insertMessage(db, profile.id, { status: 'approved' })
    const readProfile = async () => {
      const rows = await db<{ last_message_created_at: string | null }[]>`
        select last_message_created_at::text as last_message_created_at
          from app_private.profiles where id = ${profile.id}
      `
      return rows[0].last_message_created_at
    }
    const before = await readProfile()

    const result = await deleteMessage(db, {
      clerkUserId: 'delete-cooldown',
      publicId: message.public_id,
      expectedVersion: message.version,
      confirmation: true,
    })

    expect(result).toMatchObject({ ok: true, data: { deleted: true } })
    expect(await readProfile()).toBe(before)
  })
})