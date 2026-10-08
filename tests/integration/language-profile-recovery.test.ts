import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sql } from 'postgres'
import { createSecondConnection, createTestDb, insertProfile, truncateProductTables } from '../support/database'

const boundary = vi.hoisted(() => ({
  clerk: vi.fn(), database: vi.fn(), setCookie: vi.fn(),
}))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'fan' }),
  currentUser: boundary.clerk,
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: boundary.setCookie }),
  headers: async () => ({ get: () => 'en' }),
}))
vi.mock('@/server/db', () => ({ getDb: boundary.database }))

import { setLanguagePreference, synchronizeLanguagePreference } from '@/server/actions/language-preference'
import { readLanguagePreference, saveLanguagePreferenceForSession } from '@/server/auth/language-preference'

const db = createTestDb()
beforeEach(async () => {
  await truncateProductTables(db)
  vi.resetAllMocks()
  boundary.database.mockReturnValue(db)
  boundary.clerk.mockResolvedValue({ id: 'fan', username: 'ATINY', unsafeMetadata: {} })
})
afterAll(async () => { await truncateProductTables(db); await db.end() })

describe('language actions recover the local profile', () => {
  it('reads an existing preference with one database request and no Clerk lookup', async () => {
    await insertProfile(db, 'fan')
    await saveLanguagePreferenceForSession(db, 'es', async () => ({ clerkUserId: 'fan' }))
    const queries: string[] = []
    boundary.database.mockReturnValue((async (strings: TemplateStringsArray, ...values: never[]) => {
      queries.push(strings.join(''))
      return db(strings, ...values)
    }) as unknown as Sql)
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
    expect(queries).toHaveLength(1)
    expect(boundary.clerk).not.toHaveBeenCalled()
  })

  it('persists a chosen language while creating a missing profile', async () => {
    expect(await setLanguagePreference('es')).toEqual({ ok: true })
    expect(await readLanguagePreference(db, 'fan')).toBe('es')
    const rows = await db`select display_name from app_private.profiles where clerk_user_id = 'fan'`
    expect(rows).toEqual([{ display_name: 'ATINY' }])
  })

  it('keeps an incomplete signup distinct from a technical failure', async () => {
    boundary.clerk.mockResolvedValue({ id: 'fan', username: null, unsafeMetadata: {} })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'en', preference: 'auto' })
    expect(await setLanguagePreference('es')).toEqual({ ok: false })
    expect(await db`select id from app_private.profiles where clerk_user_id = 'fan'`).toHaveLength(0)

    boundary.setCookie.mockClear()
    boundary.clerk.mockRejectedValue(new Error('Clerk unavailable'))
    expect(await synchronizeLanguagePreference()).toEqual({ ok: false })
    expect(boundary.setCookie).not.toHaveBeenCalled()
  })

  it('does not overwrite a choice committed by another connection before adoption', async () => {
    const second = createSecondConnection()
    // Pause at the adoption boundary; the concurrent tab commits its explicit choice first.
    const intercepted = (async (strings: TemplateStringsArray, ...values: never[]) => {
      if (strings.join('').includes('and language_preference is null')) {
        expect(await saveLanguagePreferenceForSession(second, 'es', async () => ({ clerkUserId: 'fan' }))).toBe(true)
      }
      return db(strings, ...values)
    }) as unknown as Sql
    boundary.database.mockReturnValue(intercepted)
    try {
      expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
      expect(await readLanguagePreference(db, 'fan')).toBe('es')
    } finally { await second.end() }
  })
})
