import { afterAll, beforeAll, expect, it } from 'vitest'
import { pagePublicLetters } from '@/server/messages/public-repository'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../support/database'

const db = createTestDb()
let visible: string[]

beforeAll(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false where id = 1`
  const author = await insertProfile(db, 'archive-reader')
  visible = []
  for (let index = 0; index < 25; index++) {
    const letter = await insertMessage(db, author.id, {
      content: index === 0 ? 'Love is 100% literal_under_score' : 'Love across the seas',
      locality: 'Madrid', status: 'approved',
      published_at: '2026-10-01T10:00:00.123456Z',
    })
    visible.unshift(letter.public_id)
  }
  await insertMessage(db, author.id, { content: 'Love in Seoul', country_code: 'kr', country: 'Korea', locality: 'Seoul' })
  await insertMessage(db, author.id, { content: 'Love hidden', status: 'rejected', moderation_reason_code: 'offensive' })
  const suspended = await insertProfile(db, 'archive-suspended', { suspended_at: new Date().toISOString(), suspension_reason_code: 'harassment' })
  await insertMessage(db, suspended.id, { content: 'Love hidden', status: 'approved' })
})
afterAll(async () => { await truncateProductTables(db); await db.end() })

it('combines text, country and city globally and traverses timestamp ties without gaps', async () => {
  const criteria = { q: 'LOVE', country: 'es', city: 'madrid' }
  const first = await pagePublicLetters(db, criteria)
  expect(first.items).toHaveLength(20)
  expect(first.totalPages).toBe(2)
  expect(first.page).toBe(1)
  const second = await pagePublicLetters(db, { ...criteria, page: 2 })
  expect(second.page).toBe(2)
  expect(second.totalPages).toBe(2)
  expect([...first.items, ...second.items].map(item => item.publicId)).toEqual(visible)
})
it('searches literal text rather than interpreting wildcard characters', async () => {
  expect((await pagePublicLetters(db, { q: '100% literal_' })).items.map(item => item.publicId)).toEqual([visible.at(-1)])
})
it('shares visibility rules with moderation and suspended accounts', async () => {
  const first = await pagePublicLetters(db, { q: 'Love hidden' })
  expect(first.items).toEqual([])
  expect((await pagePublicLetters(db, { country: 'kr' })).items).toHaveLength(1)
  await db`update app_private.settings set premoderation_enabled = true where id = 1`
  try { expect((await pagePublicLetters(db, { country: 'kr' })).items).toEqual([]) }
  finally { await db`update app_private.settings set premoderation_enabled = false where id = 1` }
})

it('clamps out-of-range pages to the last matching page', async () => {
  const result = await pagePublicLetters(db, { country: 'es', city: 'Madrid', page: 999 })
  expect(result.page).toBe(2)
  expect(result.items.map(item => item.publicId)).toEqual(visible.slice(20))
})
it('counts only letters matching the filters and visibility rules', async () => {
  const result = await pagePublicLetters(db, { q: 'Love hidden', page: 2 })
  expect(result.items).toEqual([])
  expect(result.totalPages).toBe(0)
  expect(result.page).toBe(1)
})
