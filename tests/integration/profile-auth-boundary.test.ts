import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { completeProfile } from '../../src/server/auth/profiles'
import { createTestDb, truncateProductTables } from '../support/database'

const db = createTestDb()

beforeEach(async () => {
  await truncateProductTables(db)
})

afterAll(async () => {
  await truncateProductTables(db)
  await db.end()
})

describe('profile authentication boundary', () => {
  it('requires verified email and accepts a normalized unique username without persisting the email', async () => {
    await expect(completeProfile(db, {
      clerkUserId: 'profile-unverified',
      emailVerified: false,
      username: 'atiny-seoul',
      displayName: 'ATINY Seoul',
    })).resolves.toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })

    expect(await completeProfile(db, {
      clerkUserId: 'profile-verified',
      emailVerified: true,
      username: ' ATINY-Seoul ',
      displayName: 'ATINY Seoul',
    })).toMatchObject({ ok: true })

    expect(await completeProfile(db, {
      clerkUserId: 'profile-duplicate',
      emailVerified: true,
      username: 'atiny-seoul',
      displayName: 'Otro nombre',
    })).toMatchObject({ ok: false })
  })

  it('links password and Google identities to one Clerk user without accepting a client role', async () => {
    const first = await completeProfile(db, {
      clerkUserId: 'linked-identity',
      emailVerified: true,
      username: 'linked-atiny',
      displayName: 'Linked ATINY',
      identityProvider: 'password',
    })
    const linked = await completeProfile(db, {
      clerkUserId: 'linked-identity',
      emailVerified: true,
      username: 'linked-atiny',
      displayName: 'Linked ATINY',
      identityProvider: 'google',
      role: 'admin',
    })

    expect(first).toMatchObject({ ok: true })
    expect(linked).toMatchObject({ ok: true })
    const rows = await db<{ count: string; role: string }[]>`
      select count(*)::text as count, min(role) as role
        from app_private.profiles
       where clerk_user_id = 'linked-identity'
    `
    expect(rows[0]).toEqual({ count: '1', role: 'fan' })
  })
})
