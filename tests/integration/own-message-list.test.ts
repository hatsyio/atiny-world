import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { pagePublicMessages } from '../../src/server/messages/public-repository'
import { pageOwnMessages } from '../../src/server/messages/own-message-repository'
import {
  createTestDb,
  insertMessage,
  insertProfile,
  truncateProductTables,
} from '../support/database'

const db = createTestDb()

beforeEach(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set message_limit = 10, cooldown_seconds = 10 where id = 1`
})

afterAll(async () => {
  await truncateProductTables(db)
  await db.end()
})

describe('pageOwnMessages lists every owned message privately', () => {
  it('returns the four states and a moderation reason only when it exists', async () => {
    const profile = await insertProfile(db, 'own-list-states')
    const rejected = await insertMessage(db, profile.id, {
      status: 'rejected',
      moderation_reason_code: 'spam',
      moderation_note: 'Nota privada de moderación',
    })
    const approved = await insertMessage(db, profile.id, { status: 'approved' })
    const pending = await insertMessage(db, profile.id, { status: 'pending' })
    const withdrawn = await insertMessage(db, profile.id, {
      status: 'withdrawn',
      moderation_reason_code: 'conduct',
      moderation_note: 'Retirada por desactualización',
    })

    const page = await pageOwnMessages(db, { clerkUserId: 'own-list-states', limit: 10 })

    const byId = new Map(page.items.map((item) => [item.publicId, item]))
    expect(byId.has(rejected.public_id)).toBe(true)
    expect(byId.has(approved.public_id)).toBe(true)
    expect(byId.has(pending.public_id)).toBe(true)
    expect(byId.has(withdrawn.public_id)).toBe(true)

    const reasonOnlyOnHiddenStates = page.items.every(
      (item) =>
        (item.status === 'approved' || item.status === 'pending') ===
        (item.moderationReasonCode === null && item.moderationNote === null),
    )
    expect(reasonOnlyOnHiddenStates).toBe(true)
    expect(byId.get(rejected.public_id)).toMatchObject({
      status: 'rejected',
      moderationReasonCode: 'spam',
      moderationNote: 'Nota privada de moderación',
      content: 'Un mensaje de prueba',
    })
    expect(byId.get(withdrawn.public_id)).toMatchObject({
      status: 'withdrawn',
      moderationReasonCode: 'conduct',
      moderationNote: 'Retirada por desactualización',
    })
  })

  it('returns only the queried profile own messages', async () => {
    const owner = await insertProfile(db, 'own-list-owner')
    const other = await insertProfile(db, 'own-list-other')
    const ownedId = (await insertMessage(db, owner.id, { status: 'approved' })).public_id
    await insertMessage(db, other.id, {
      status: 'rejected',
      moderation_reason_code: 'fixture',
      moderation_note: 'Motivo ajeno privado',
    })

    const page = await pageOwnMessages(db, { clerkUserId: 'own-list-owner', limit: 10 })

    expect(page.items.map((item) => item.publicId)).toEqual([ownedId])
    expect(JSON.stringify(page.items)).not.toContain('Motivo ajeno privado')
  })

  it('stays consultable for a suspended owner', async () => {
    const profile = await insertProfile(db, 'own-list-suspended', {
      suspended_at: '2026-09-01T00:00:00Z',
      suspension_reason_code: 'conduct',
    })
    const message = await insertMessage(db, profile.id, { status: 'rejected', moderation_reason_code: 'spam' })

    const page = await pageOwnMessages(db, { clerkUserId: 'own-list-suspended', limit: 10 })

    expect(page.items.map((item) => item.publicId)).toEqual([message.public_id])
  })

  it('paginates with a stable cursor without losing or duplicating rows', async () => {
    const profile = await insertProfile(db, 'own-list-pages')
    const inserted: string[] = []
    for (let index = 0; index < 7; index += 1) {
      inserted.push((await insertMessage(db, profile.id, { status: index % 2 === 0 ? 'approved' : 'pending' })).public_id)
    }

    const walk = async () => {
      const collected: string[] = []
      let cursor: string | undefined
      do {
        const page = await pageOwnMessages(db, {
          clerkUserId: 'own-list-pages',
          cursor,
          limit: 2,
        })
        collected.push(...page.items.map((item) => item.publicId))
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      return collected
    }

    const first = await walk()
    const second = await walk()

    expect(new Set(first).size).toBe(inserted.length)
    expect(new Set(inserted).size).toBe(inserted.length)
    expect(first).toEqual([...inserted].reverse())
    expect(second).toEqual(first)
  })
})

describe('owner message details never reach public reads', () => {
  it('exposes only public fields and never rejected or withdrawn rows', async () => {
    const profile = await insertProfile(db, 'own-list-public')
    await insertMessage(db, profile.id, {
      status: 'approved',
      latitude: 39.9,
      longitude: -3.7,
    })
    const rejectedId = (await insertMessage(db, profile.id, {
      status: 'rejected',
      moderation_reason_code: 'spam',
      latitude: 39.91,
      longitude: -3.71,
    })).public_id
    const withdrawnId = (await insertMessage(db, profile.id, {
      status: 'withdrawn',
      moderation_reason_code: 'conduct',
      latitude: 39.92,
      longitude: -3.72,
    })).public_id

    const page = await pagePublicMessages(db, {
      bounds: { west: -180, south: -90, east: 180, north: 90 },
      limit: 50,
    })

    const ids = page.items.map((item) => item.publicId)
    expect(ids).not.toContain(rejectedId)
    expect(ids).not.toContain(withdrawnId)

    for (const item of page.items) {
      expect(Object.keys(item).sort()).toEqual([
        'author',
        'content',
        'country',
        'locality',
        'point',
        'precision',
        'publicId',
        'publishedAt',
        'recipient',
      ])
      expect('status' in item).toBe(false)
      expect('moderationReasonCode' in item).toBe(false)
      expect('moderationNote' in item).toBe(false)
    }
  })
})