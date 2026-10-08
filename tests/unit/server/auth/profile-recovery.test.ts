import { describe, expect, it, vi } from 'vitest'
import type { Sql } from 'postgres'
import { recoverProfile } from '../../../../src/server/auth/profile-recovery'

const identity = { clerkUserId: 'fan' }
const user = { id: 'fan', username: 'ATINY', unsafeMetadata: {} }
const profile = { id: '1', public_id: 'public-id', display_name: 'Original', role: 'fan', account_state: 'active', suspended_at: null }

describe('local profile recovery', () => {
  it('uses an existing profile even when Clerk is unavailable', async () => {
    expect(await recoverProfile({} as Sql, identity, async () => { throw new Error('offline') }, async () => profile))
      .toEqual({ kind: 'available', profile })
  })

  it('returns an incomplete signup for a missing public name', async () => {
    expect(await recoverProfile({} as Sql, identity, async () => ({ ...user, username: null }), async () => null))
      .toMatchObject({ kind: 'incomplete', error: { code: 'VALIDATION_ERROR', fieldErrors: { username: 'profile.usernameRequired' } } })
  })

  it('rejects a Clerk identity belonging to another account', async () => {
    expect(await recoverProfile({} as Sql, identity, async () => ({ ...user, id: 'other' }), async () => null))
      .toMatchObject({ kind: 'failed', error: { code: 'NOT_FOUND' } })
  })

  it.each(['profile read', 'Clerk read', 'creation', 'read after creation'])('classifies %s failures as technical errors', async (stage) => {
    const read = vi.fn().mockResolvedValue(null)
    const clerk = vi.fn().mockResolvedValue(user)
    const sql = vi.fn().mockResolvedValue([{ public_id: 'public-id', display_name: 'ATINY' }])
    if (stage === 'profile read') read.mockRejectedValue(new Error('offline'))
    if (stage === 'Clerk read') clerk.mockRejectedValue(new Error('offline'))
    if (stage === 'creation') sql.mockRejectedValue(new Error('offline'))
    if (stage === 'read after creation') read.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'))
    expect(await recoverProfile(sql as unknown as Sql, identity, clerk, read))
      .toMatchObject({ kind: 'failed', error: { code: 'INTERNAL_ERROR' } })
  })
})
