import { describe, expect, it } from 'vitest'

import type { Sql } from 'postgres'

import {
  resolveAccountGate,
  writeLetterRedirect,
  type AccountGate,
} from '../../../../src/server/auth/account-gate'
import type { SessionProfileRow } from '../../../../src/server/auth/session'

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

describe('resolveAccountGate', () => {
  it('treats a missing Clerk session as anonymous', async () => {
    const gate = await resolveAccountGate(
      {} as Sql,
      async () => ({ userId: null }),
      async () => row(),
    )

    expect(gate).toEqual({ kind: 'anonymous' })
  })

  it('gates authenticated accounts without a usable profile', async () => {
    expect(
      await resolveAccountGate(
        {} as Sql,
        async () => ({ userId: 'user_123' }),
        async () => null,
        async () => false,
      ),
    ).toEqual({ kind: 'incomplete' })

    expect(
      await resolveAccountGate(
        {} as Sql,
        async () => ({ userId: 'user_123' }),
        async () => row({ display_name: '  ' }),
      ),
    ).toEqual({ kind: 'incomplete' })
  })

  it('keeps suspended and deletion-pending accounts without publish access', async () => {
    expect(
      await resolveAccountGate(
        {} as Sql,
        async () => ({ userId: 'user_123' }),
        async () => row({ suspended_at: '2026-09-15T00:00:00Z' }),
      ),
    ).toEqual({ kind: 'suspended' })

    expect(
      await resolveAccountGate(
        {} as Sql,
        async () => ({ userId: 'user_123' }),
        async () => row({ account_state: 'deletion_pending' }),
      ),
    ).toEqual({ kind: 'deletion-pending' })
  })

  it('allows a complete active profile', async () => {
    const gate = await resolveAccountGate(
      {} as Sql,
      async () => ({ userId: 'user_123' }),
      async () => row(),
    )

    expect(gate).toMatchObject({ kind: 'allowed', profile: { role: 'fan' } })
  })
})

describe('writeLetterRedirect', () => {
  const gate: AccountGate = { kind: 'incomplete' }

  it('directs anonymous and incomplete accounts to the localized exit', () => {
    expect(writeLetterRedirect({ kind: 'anonymous' }, 'es')).toBe('/es/sign-in')
    expect(writeLetterRedirect({ kind: 'anonymous' }, 'en')).toBe('/en/sign-in')
    expect(writeLetterRedirect(gate, 'es')).toBe('/es/profile')
  })

  it('lets allowed accounts continue while preserving the route language', () => {
    expect(writeLetterRedirect({ kind: 'suspended' }, 'en')).toBeNull()
    expect(writeLetterRedirect({ kind: 'deletion-pending' }, 'en')).toBeNull()
  })
})
