import { afterAll, beforeEach, expect, it } from 'vitest'
import { GET } from '@/app/api/map/filter-options/route'
import { getDb } from '@/server/db/client'
import { listPublicLetterLocations } from '@/server/messages/public-repository'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../support/database'

const db = createTestDb()
beforeEach(async () => {
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false where id = 1`
})
afterAll(async () => {
  await db`update app_private.settings set premoderation_enabled = false where id = 1`
  await truncateProductTables(db)
  await db.end()
  await getDb().end()
})
it('deduplicates public locations, excludes empty cities and follows moderation and author visibility', async () => {
  const active = await insertProfile(db, 'locations-active')
  const suspended = await insertProfile(db, 'locations-suspended', { suspended_at: new Date().toISOString(), suspension_reason_code: 'harassment' })
  const deleting = await insertProfile(db, 'locations-deleting', { account_state: 'deletion_pending' })
  await insertMessage(db, active.id, { status: 'approved', locality: 'Madrid' })
  await insertMessage(db, active.id, { status: 'approved', locality: 'Madrid' })
  await insertMessage(db, active.id, { locality: 'Seoul', country: 'Korea', country_code: 'kr' })
  await insertMessage(db, active.id, { status: 'approved', locality: null, country: 'France', country_code: 'fr' })
  await insertMessage(db, active.id, { status: 'approved', locality: '  ', country: 'France', country_code: 'fr' })
  await insertMessage(db, active.id, { status: 'rejected', moderation_reason_code: 'offensive', locality: 'Tirana', country: 'Albania', country_code: 'al' })
  await insertMessage(db, active.id, { status: 'withdrawn', moderation_reason_code: 'self', locality: 'London', country: 'UK', country_code: 'gb' })
  await insertMessage(db, suspended.id, { status: 'approved', locality: 'Tokyo', country: 'Japan', country_code: 'jp' })
  await insertMessage(db, deleting.id, { status: 'approved', locality: 'Berlin', country: 'Germany', country_code: 'de' })
  expect(await listPublicLetterLocations(db)).toEqual([
    { country: 'es', city: 'Madrid' }, { country: 'fr', city: null }, { country: 'kr', city: 'Seoul' },
  ])
  await db`update app_private.settings set premoderation_enabled = true where id = 1`
  expect(await listPublicLetterLocations(db)).toEqual([{ country: 'es', city: 'Madrid' }, { country: 'fr', city: null }])
})
it('returns no options when there are no public letters', async () => {
  expect(await listPublicLetterLocations(db)).toEqual([])
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ locations: [] })
})
