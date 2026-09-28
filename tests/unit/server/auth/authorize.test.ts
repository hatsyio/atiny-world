import { describe, expect, it } from 'vitest'

import type { Sql } from 'postgres'

import {
  authorizeProfile,
  authorizeSession,
  isProfileComplete,
  requireRole,
  resolveProfileState,
  toAuthorizeActionResult,
  type AuthorizedProfile,
} from '../../../../src/server/auth/authorize'
import type { SessionIdentity, SessionProfileRow } from '../../../../src/server/auth/session'

function row(overrides: Partial<SessionProfileRow> = {}): SessionProfileRow {
  return {
    id: '42',
    public_id: '00000000-0000-4000-8000-000000000001',
    display_name: 'ATINY',
    role: 'fan',
    account_state: 'active',
    suspended_at: null,
    ...overrides,
  }
}

describe('isProfileComplete', () => {
  it('requires a non-blank display name', () => {
    expect(isProfileComplete(row())).toBe(true)
    expect(isProfileComplete(row({ display_name: '' }))).toBe(false)
  })
})

describe('resolveProfileState', () => {
  it('resolves a complete active profile to the current role', () => {
    const result = resolveProfileState(row({ role: 'admin' }))

    expect(result).toEqual({
      ok: true,
      profile: {
        profileId: '42',
        publicId: '00000000-0000-4000-8000-000000000001',
        displayName: 'ATINY',
        role: 'admin',
      },
    })
  })

  it('rejects null, incomplete and unknown-role profiles as incomplete', () => {
    expect(resolveProfileState(null).ok).toBe(false)
    expect(resolveProfileState(row({ display_name: '' })).ok).toBe(false)
    expect(resolveProfileState(row({ role: 'superuser' })).ok).toBe(false)
  })

  it('distinguishes suspension and deletion-pending accounts', () => {
    expect(
      resolveProfileState(row({ suspended_at: '2026-09-15T00:00:00Z' })),
    ).toEqual({ ok: false, error: { kind: 'ACCOUNT_SUSPENDED' } })
    expect(
      resolveProfileState(row({ account_state: 'deletion_pending' })),
    ).toEqual({ ok: false, error: { kind: 'ACCOUNT_DELETION_PENDING' } })
  })
})

describe('toAuthorizeActionResult', () => {
  it('preserves authorized profiles', () => {
    const profile: AuthorizedProfile = {
      profileId: '42',
      publicId: '00000000-0000-4000-8000-000000000001',
      displayName: 'ATINY',
      role: 'fan',
    }
    expect(toAuthorizeActionResult({ ok: true, profile })).toEqual({
      ok: true,
      data: profile,
    })
  })

  it('maps every denial reason to a stable problem', () => {
    expect(
      toAuthorizeActionResult({ ok: false, error: { kind: 'PROFILE_INCOMPLETE' } }),
    ).toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })

    expect(
      toAuthorizeActionResult({ ok: false, error: { kind: 'ACCOUNT_SUSPENDED' } }),
    ).toMatchObject({ ok: false, error: { code: 'ACCOUNT_SUSPENDED' } })

    expect(
      toAuthorizeActionResult({ ok: false, error: { kind: 'ACCOUNT_DELETION_PENDING' } }),
    ).toMatchObject({ ok: false, error: { code: 'ACCOUNT_SUSPENDED' } })
  })
})

describe('authorizeProfile', () => {
  const identity: SessionIdentity = { clerkUserId: 'user_123' }

  async function withRow(sessionRow: SessionProfileRow | null) {
    const sql = {} as Sql
    return authorizeProfile(sql, identity, async () => sessionRow)
  }

  it('resolves an active complete profile', async () => {
    const result = await withRow(row())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.role).toBe('fan')
  })

  it('denies an unauthenticated profile lookup', async () => {
    const result = await withRow(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROFILE_INCOMPLETE')
  })
})

describe('authorizeSession', () => {
  it('denies when Clerk reports no session', async () => {
    const result = await authorizeSession({} as Sql, async () => ({ userId: null }), async () => row())

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('resolves the profile for the authenticated session', async () => {
    const result = await authorizeSession(
      {} as Sql,
      async () => ({ userId: 'user_123' }),
      async () => row(),
    )

    expect(result).toMatchObject({
      ok: true,
      data: { profileId: '42', role: 'fan' },
    })
  })
})

describe('requireRole', () => {
  const fan: AuthorizedProfile = {
    profileId: '42',
    publicId: '00000000-0000-4000-8000-000000000001',
    displayName: 'ATINY',
    role: 'fan',
  }
  const admin: AuthorizedProfile = { ...fan, role: 'admin' }

  it('allows members of the requested roles', async () => {
    expect(await requireRole(admin, ['admin', 'owner'])).toMatchObject({
      ok: true,
      data: admin,
    })
  })

  it('denies profiles outside the requested roles', async () => {
    expect(await requireRole(fan, ['admin', 'owner'])).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })
})
