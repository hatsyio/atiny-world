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

function clerkUser(id: string, username: string | null, verified = true, legacyPublicName?: string) {
  return {
    id,
    username,
    primaryEmailAddressId: 'email_1',
    emailAddresses: [{ id: 'email_1', verification: { status: verified ? 'verified' : 'unverified' } }],
    unsafeMetadata: legacyPublicName ? { publicName: legacyPublicName } : {},
  }
}

const session = (id: string) => async () => ({ clerkUserId: id })

async function finish(id: string, username: string | null, verified = true) {
  return completeProfileForSession(db, session(id), async () => clerkUser(id, username, verified))
}

describe('Clerk username signup boundary', () => {
  it('requires a verified identity and accepts the full Clerk username length', async () => {
    expect(await finish('unverified', 'atiny_fan', false)).toMatchObject({ ok: false, error: { code: 'PROFILE_INCOMPLETE' } })
    expect(await finish('missing', null)).toMatchObject({ ok: false, error: { fieldErrors: { username: 'profile.usernameRequired' } } })
    expect(await finish('long', 'a'.repeat(65))).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(await finish('verified', 'a'.repeat(64))).toMatchObject({ ok: true })
    const rows = await db<{ display_name: string }[]>`select display_name from app_private.profiles where clerk_user_id = 'verified'`
    expect(rows[0].display_name).toBe('a'.repeat(64))
  })

  it('keeps Clerk IDs and public UUIDs distinct for different usernames', async () => {
    const first = await finish('fan-one', 'atiny_one')
    const second = await finish('fan-two', 'atiny_two')
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.data.profilePublicId).not.toBe(second.data.profilePublicId)
    const rows = await db<{ clerk_user_id: string; display_name: string }[]>`select clerk_user_id, display_name from app_private.profiles order by clerk_user_id`
    expect(rows).toEqual([{ clerk_user_id: 'fan-one', display_name: 'atiny_one' }, { clerk_user_id: 'fan-two', display_name: 'atiny_two' }])
    const found = await searchPublicUsers(db, { query: 'atiny' })
    expect(found.items.map((item) => item.publicId)).toEqual([first.data.profilePublicId, second.data.profilePublicId])
  })

  it('accepts a verified Google identity after OAuth signup', async () => {
    const result = await completeProfileForSession(db, session('google-fan'), async () => ({
      id: 'google-fan',
      username: 'google_atiny',
      primaryEmailAddressId: null,
      emailAddresses: [],
      externalAccounts: [{ provider: 'google' }],
      unsafeMetadata: {},
    }))
    expect(result).toMatchObject({ ok: true })
  })

  it('retries safely without changing the existing name, role, UUID or letters', async () => {
    const first = await finish('fan-one', 'Original')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const profile = await db<{ id: string }[]>`select id from app_private.profiles where clerk_user_id = 'fan-one'`
    const message = await insertMessage(db, profile[0].id)
    const again = await finish('fan-one', 'changed_username')
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
    const second = await finish('existing', 'new_username')
    expect(second).toMatchObject({ ok: true })
    if (first.ok && second.ok) expect(second.data.profilePublicId).toBe(first.data.publicId)
    const authorization = await authorizeProfile(db, { clerkUserId: 'existing' }, readProfileByClerkUserId)
    expect(authorization).toMatchObject({ ok: true, data: { displayName: 'Existing' } })
  })

  it('recovers an unfinished legacy sign-up with the previously chosen Unicode name', async () => {
    const result = await completeProfileForSession(db, session('legacy-fan'), async () => clerkUser('legacy-fan', null, true, 'ATINY 서울 🌙'))
    expect(result).toMatchObject({ ok: true })
    const rows = await db<{ display_name: string }[]>`select display_name from app_private.profiles where clerk_user_id = 'legacy-fan'`
    expect(rows[0].display_name).toBe('ATINY 서울 🌙')
  })
})
