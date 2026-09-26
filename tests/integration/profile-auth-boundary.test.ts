import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { completeProfileForSession } from '../../src/server/actions/complete-profile'
import { completeProfile } from '../../src/server/auth/profiles'
import { resolveAccountGate } from '../../src/server/auth/account-gate'
import { authorizeProfile } from '../../src/server/auth/authorize'
import { readProfileByClerkUserId } from '../../src/server/auth/session'
import { searchPublicUsers } from '../../src/server/messages/public-repository'
import { createTestDb, insertMessage, truncateProductTables } from '../support/database'

const db = createTestDb()

beforeEach(async () => { await truncateProductTables(db) })
afterAll(async () => { await truncateProductTables(db); await db.end() })

function clerkUser(id: string, publicName: unknown, verified = true) {
  return {
    id,
    primaryEmailAddressId: 'email_1',
    emailAddresses: [{ id: 'email_1', verification: { status: verified ? 'verified' : 'unverified' } }],
    unsafeMetadata: { publicName },
  }
}

const session = (id: string) => async () => ({ clerkUserId: id })

async function finish(id: string, publicName: unknown, verified = true) {
  return completeProfileForSession(db, session(id), async () => clerkUser(id, publicName, verified))
}

describe('public-name signup boundary', () => {
  it('requires a verified identity and validates Unicode names on the server', async () => {
    expect(await finish('unverified', 'ATINY 🌙', false)).toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })
    expect(await finish('empty', '  ')).toMatchObject({ ok: false, error: { fieldErrors: { publicName: 'profile.publicNameRequired' } } })
    expect(await finish('long', '🦋'.repeat(51))).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await finish('verified', '  ATINY 서울 🌙  ')).toMatchObject({ ok: true })
    const rows = await db<{ display_name: string }[]>`select display_name from app_private.profiles where clerk_user_id = 'verified'`
    expect(rows[0].display_name).toBe('ATINY 서울 🌙')
  })

  it('allows duplicate names while keeping Clerk IDs and public UUIDs distinct', async () => {
    const first = await finish('fan-one', 'ATINY 🌙')
    const second = await finish('fan-two', 'ATINY 🌙')
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.data.profilePublicId).not.toBe(second.data.profilePublicId)
    const rows = await db<{ clerk_user_id: string; display_name: string }[]>`select clerk_user_id, display_name from app_private.profiles order by clerk_user_id`
    expect(rows).toEqual([{ clerk_user_id: 'fan-one', display_name: 'ATINY 🌙' }, { clerk_user_id: 'fan-two', display_name: 'ATINY 🌙' }])
    const found = await searchPublicUsers(db, { query: 'ATINY' })
    expect(found.items.map((item) => item.publicId)).toEqual([first.data.profilePublicId, second.data.profilePublicId])
  })

  it('accepts a verified Google identity after OAuth signup', async () => {
    const result = await completeProfileForSession(db, session('google-fan'), async () => ({
      id: 'google-fan',
      primaryEmailAddressId: null,
      emailAddresses: [],
      externalAccounts: [{ provider: 'google' }],
      unsafeMetadata: { publicName: 'Google ATINY' },
    }))
    expect(result).toMatchObject({ ok: true })
  })

  it('retries safely without changing the existing name, role, UUID or letters', async () => {
    const first = await finish('fan-one', 'Original')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const profile = await db<{ id: string }[]>`select id from app_private.profiles where clerk_user_id = 'fan-one'`
    const message = await insertMessage(db, profile[0].id)
    const again = await finish('fan-one', 'Changed metadata')
    expect(again).toEqual(first)
    const rows = await db<{ role: string; display_name: string }[]>`select role, display_name from app_private.profiles where clerk_user_id = 'fan-one'`
    expect(rows[0]).toEqual({ role: 'fan', display_name: 'Original' })
    const letters = await db<{ id: string }[]>`select id from app_private.messages where author_id = ${profile[0].id}`
    expect(letters[0].id).toBe(message.id)
  })

  it('rejects forged session identity and gates writes until profile creation succeeds', async () => {
    expect(await completeProfileForSession(db, async () => null, async () => clerkUser('fan', 'Name'))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await completeProfileForSession(db, session('fan'), async () => clerkUser('other', 'Name'))).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(await authorizeProfile(db, { clerkUserId: 'fan' }, readProfileByClerkUserId)).toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })
    const gate = await resolveAccountGate(db, async () => ({ userId: 'fan' }), readProfileByClerkUserId, async () => false)
    expect(gate).toEqual({ kind: 'incomplete' })
  })

  it('keeps an existing account and public UUID after metadata or email changes', async () => {
    const first = await completeProfile(db, { clerkUserId: 'existing', emailVerified: true, displayName: 'Existing' })
    expect(first.ok).toBe(true)
    const second = await finish('existing', 'New metadata')
    expect(second).toMatchObject({ ok: true })
    if (first.ok && second.ok) expect(second.data.profilePublicId).toBe(first.data.publicId)
    const authorization = await authorizeProfile(db, { clerkUserId: 'existing' }, readProfileByClerkUserId)
    expect(authorization).toMatchObject({ ok: true, data: { displayName: 'Existing' } })
  })
})
