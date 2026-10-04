import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { readLanguagePreference, saveLanguagePreferenceForSession } from '@/server/auth/language-preference'
import { createTestDb, insertProfile, truncateProductTables } from '../support/database'

const db = createTestDb()
beforeEach(async () => { await truncateProductTables(db) })
afterAll(async () => { await truncateProductTables(db); await db.end() })

describe('profile language persistence', () => {
  it('starts unset, persists explicit and auto preferences only for the signed-in identity', async () => {
    await insertProfile(db, 'a')
    await insertProfile(db, 'b')
    expect(await readLanguagePreference(db, 'a')).toBeNull()
    expect(await saveLanguagePreferenceForSession(db, 'es', async () => ({ clerkUserId: 'a' }))).toBe(true)
    expect(await readLanguagePreference(db, 'a')).toBe('es')
    expect(await readLanguagePreference(db, 'b')).toBeNull()
    expect(await saveLanguagePreferenceForSession(db, 'auto', async () => ({ clerkUserId: 'a' }))).toBe(true)
    expect(await readLanguagePreference(db, 'a')).toBe('auto')
  })
  it('rejects unauthenticated updates and unsupported DB values', async () => {
    await insertProfile(db, 'a')
    expect(await saveLanguagePreferenceForSession(db, 'es', async () => null)).toBe(false)
    expect(await readLanguagePreference(db, 'a')).toBeNull()
    await expect(db`update app_private.profiles set language_preference = 'fr' where clerk_user_id = 'a'`).rejects.toMatchObject({ code: '23514' })
  })
})
