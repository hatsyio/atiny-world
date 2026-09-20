import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { completeProfileForSession } from '../../src/server/actions/complete-profile'
import { completeProfile } from '../../src/server/auth/profiles'
import { resolveAccountGate } from '../../src/server/auth/account-gate'
import { authorizeProfile } from '../../src/server/auth/authorize'
import { readProfileByClerkUserId } from '../../src/server/auth/session'
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

  it('authorizes a session only after the profile is complete', async () => {
    const before = await authorizeProfile(
      db,
      { clerkUserId: 'boundary-verified' },
      readProfileByClerkUserId,
    )
    expect(before).toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })
    expect(
      await resolveAccountGate(
        db,
        async () => ({ userId: 'boundary-verified' }),
        readProfileByClerkUserId,
      ),
    ).toEqual({ kind: 'incomplete' })

    await completeProfile(db, {
      clerkUserId: 'boundary-verified',
      emailVerified: true,
      username: 'boundary-atiny',
      displayName: 'Boundary ATINY',
    })

    const after = await authorizeProfile(
      db,
      { clerkUserId: 'boundary-verified' },
      readProfileByClerkUserId,
    )
    expect(after).toMatchObject({
      ok: true,
      data: { username: 'boundary-atiny', displayName: 'Boundary ATINY', role: 'fan' },
    })
    expect(
      await resolveAccountGate(
        db,
        async () => ({ userId: 'boundary-verified' }),
        readProfileByClerkUserId,
      ),
    ).toEqual({ kind: 'allowed', profile: expect.objectContaining({ role: 'fan' }) })
  })

  it('keeps write entry anonymous or gated when the session or profile is missing', async () => {
    expect(
      await resolveAccountGate(db, async () => ({ userId: null })),
    ).toEqual({ kind: 'anonymous' })

    expect(
      await resolveAccountGate(
        db,
        async () => ({ userId: 'boundary-missing' }),
        readProfileByClerkUserId,
      ),
    ).toEqual({ kind: 'incomplete' })
  })

  it('completes the profile through the session action with server-derived identity', async () => {
    const result = await completeProfileForSession(
      db,
      { username: ' server-atiny ', displayName: '  Server ATINY ' },
      async () => ({ clerkUserId: 'action-verified' }),
      async () => ({
        primaryEmailAddressId: 'email_1',
        emailAddresses: [{ id: 'email_1', verification: { status: 'verified' } }],
        externalAccounts: [{ provider: 'google' }],
      }),
    )

    expect(result).toMatchObject({ ok: true, data: { profilePublicId: expect.any(String) } })

    const rows = await db<{ role: string }[]>`
      select role from app_private.profiles where clerk_user_id = 'action-verified'
    `
    expect(rows[0].role).toBe('fan')
  })

  it('rejects a session action without session, verifiable identity or email', async () => {
    const verifiedClerkUser = async () => ({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', verification: { status: 'verified' } }],
    })

    expect(
      await completeProfileForSession(
        db,
        { username: 'x', displayName: 'X' },
        async () => null,
        verifiedClerkUser,
      ),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'auth.unauthenticated' } })

    expect(
      await completeProfileForSession(
        db,
        { username: 'x', displayName: 'X' },
        async () => ({ clerkUserId: 'action-unverified' }),
        async () => ({
          primaryEmailAddressId: 'email_1',
          emailAddresses: [{ id: 'email_1', verification: { status: 'unverified' } }],
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'PROFILE_INCOMPLETE', messageKey: 'profile.incomplete' },
    })
  })

  it('rejects invalid profile data with per-field errors', async () => {
    const session = async () => ({ clerkUserId: 'action-invalid' })
    const verifiedClerkUser = async () => ({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', verification: { status: 'verified' } }],
    })

    expect(
      await completeProfileForSession(db, { username: '  ', displayName: '' }, session, verifiedClerkUser),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { username: expect.any(String), displayName: expect.any(String) } },
    })

    expect(
      await completeProfileForSession(db, {
        username: 'x'.repeat(31),
        displayName: 'y'.repeat(51),
      }, session, verifiedClerkUser),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { username: expect.any(String), displayName: expect.any(String) } },
    })
  })
})
