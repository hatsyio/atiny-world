import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  listFeaturesInViewport,
  listLatestPublicMessages,
  pagePublicMessages,
  getVisibleMessage,
  type MapBounds,
} from '../../src/server/messages/public-repository'
import {
  createTestDb,
  insertMessage,
  insertProfile,
  truncateProductTables,
} from '../support/database'

const db = createTestDb()

const madridBounds: MapBounds = {
  west: -3.9,
  south: 40.2,
  east: -3.5,
  north: 40.6,
}

describe('public message reads share one visibility rule', () => {
  let authorId: string
  let approvedId: string
  let pendingId: string
  let rejectedId: string
  let withdrawnId: string

  beforeAll(async () => {
    await truncateProductTables(db)
    const profile = await insertProfile(db, 'reads-attiny', {
      username: 'reads-attiny',
      display_name: 'Reads ATINY',
    })
    authorId = profile.id

    approvedId = (await insertMessage(db, authorId, {
      status: 'approved',
      longitude: -3.7,
      latitude: 40.4,
      published_at: '2026-09-28T10:00:00.000Z',
    })).public_id
    pendingId = (await insertMessage(db, authorId, {
      status: 'pending',
      longitude: -3.71,
      latitude: 40.41,
      published_at: '2026-09-29T10:00:00.000Z',
    })).public_id
    rejectedId = (await insertMessage(db, authorId, {
      status: 'rejected',
      moderation_reason_code: 'offensive',
      longitude: -3.72,
      latitude: 40.42,
    })).public_id
    withdrawnId = (await insertMessage(db, authorId, {
      status: 'withdrawn',
      moderation_reason_code: 'self',
      longitude: -3.73,
      latitude: 40.43,
    })).public_id
  })

  afterAll(async () => {
    await truncateProductTables(db)
    await db.end()
  })

  it('reveals approved and unmoderated pending in the viewport, never rejected/withdrawn', async () => {
    const features = await listFeaturesInViewport(db, madridBounds)
    const ids = new Set(features.map((feature) => feature.publicId))

    expect(ids.has(approvedId)).toBe(true)
    expect(ids.has(pendingId)).toBe(true)
    expect(ids.has(rejectedId)).toBe(false)
    expect(ids.has(withdrawnId)).toBe(false)
  })

  it('hides all of an author once suspended or pending deletion', async () => {
    await db`
      update app_private.profiles set suspended_at = now(), suspension_reason_code = 'harassment'
      where id = ${authorId}
    `
    expect(await listFeaturesInViewport(db, madridBounds)).toHaveLength(0)

    await db`
      update app_private.profiles set suspended_at = null, suspension_reason_code = null
      where id = ${authorId}
    `

    await db`
      update app_private.profiles set account_state = 'deletion_pending'
      where id = ${authorId}
    `
    expect(await listFeaturesInViewport(db, madridBounds)).toHaveLength(0)

    await db`
      update app_private.profiles set account_state = 'active'
      where id = ${authorId}
    `
  })

  it('keeps pending messages hidden when premoderation is on', async () => {
    await db`update app_private.settings set premoderation_enabled = true where id = 1`
    try {
      const features = await listFeaturesInViewport(db, madridBounds)
      const ids = new Set(features.map((feature) => feature.publicId))
      expect(ids.has(pendingId)).toBe(false)
      expect(ids.has(approvedId)).toBe(true)
    } finally {
      await db`update app_private.settings set premoderation_enabled = false where id = 1`
    }
  })

  it('returns stable group pagination with the same rule and no duplicates', async () => {
    const first = await pagePublicMessages(db, { bounds: madridBounds, limit: 1 })
    expect(first.items.length).toBe(1)

    const second = await pagePublicMessages(db, {
      bounds: madridBounds,
      cursor: first.nextCursor ?? undefined,
      limit: 10,
    })

    const ids = [
      ...first.items.map((item) => item.publicId),
      ...second.items.map((item) => item.publicId),
    ]
    expect(ids).toContain(approvedId)
    expect(ids).not.toContain(rejectedId)
    expect(ids).not.toContain(withdrawnId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('orders group items by publishedAt DESC with the stable tie-break', async () => {
    const page = await pagePublicMessages(db, { bounds: madridBounds, limit: 10 })
    const published = page.items.map((item) => item.publishedAt)

    for (let index = 1; index < published.length; index += 1) {
      expect(published[index - 1] >= published[index]).toBe(true)
    }
  })

  it('returns the latest global public messages independent of viewport', async () => {
    const latest = await listLatestPublicMessages(db, 4)

    expect(latest.map((item) => item.publicId)).toEqual([pendingId, approvedId])
    expect(latest[0]?.content).toBe('Un mensaje de prueba')
  })

  it('resolves only the visible detail and hides rejected or absent rows', async () => {
    expect((await getVisibleMessage(db, approvedId))?.publicId).toBe(approvedId)
    expect(await getVisibleMessage(db, rejectedId)).toBeNull()
    expect(
      await getVisibleMessage(db, '00000000-0000-4000-8000-000000000001'),
    ).toBeNull()
  })

})
