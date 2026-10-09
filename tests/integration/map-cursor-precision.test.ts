import { afterAll, expect, it } from 'vitest'
import { pagePublicMessages } from '@/server/messages/public-repository'
import { createTestDb, insertMessage, insertProfile } from '../support/database'

const db = createTestDb()
afterAll(() => db.end())
it('loads every letter when a cursor boundary shares a microsecond timestamp', async () => {
  const profile = await insertProfile(db, 'map-cursor-microseconds')
  try {
    const created = []
    for (let index = 0; index < 3; index++) created.push(await insertMessage(db, profile.id, {
      status: 'approved', locality: 'CursorMicroseconds', longitude: -3.7, latitude: 40.4,
      published_at: '2026-10-10T10:00:00.123456Z',
    }))
    const args = { bounds: { west: -4, south: 40, east: -3, north: 41 }, city: 'CursorMicroseconds', limit: 1 }
    let cursor: string | undefined
    const ids: string[] = []
    do {
      const page = await pagePublicMessages(db, { ...args, cursor })
      ids.push(...page.items.map(item => item.publicId))
      cursor = page.nextCursor ?? undefined
    } while (cursor && ids.length < 5)
    expect(ids).toEqual(created.reverse().map(letter => letter.public_id))
  } finally {
    await db`delete from app_private.messages where author_id = ${profile.id}`
    await db`delete from app_private.profiles where id = ${profile.id}`
  }
})
