import type { Sql } from '@/server/db/sql'
import { describe, expect, it, vi } from 'vitest'

import { getVisibleMessage } from '@/server/messages/public-repository'
import { getOwnMessage } from '@/server/messages/own-message-repository'

const validId = '44e25e85-0351-40a4-8b7b-39ebd02e30cd'

describe('message lookup identifiers', () => {
  it.each([`${validId}%5C`, `${validId}\\`, 'not-a-uuid', ''])('returns no message without querying PostgreSQL for %s', async publicId => {
    const sql = vi.fn(() => { throw new Error('Invalid identifiers must not reach PostgreSQL') })
    const db = sql as unknown as Sql

    await expect(getVisibleMessage(db, publicId)).resolves.toBeNull()
    await expect(getOwnMessage(db, { clerkUserId: 'owner', publicId })).resolves.toBeNull()
    expect(sql).not.toHaveBeenCalled()
  })

  it('queries PostgreSQL for valid identifiers', async () => {
    const sql = vi.fn(() => [])
    const db = sql as unknown as Sql

    await expect(getVisibleMessage(db, validId)).resolves.toBeNull()
    await expect(getOwnMessage(db, { clerkUserId: 'owner', publicId: validId })).resolves.toBeNull()
    expect(sql).toHaveBeenCalled()
  })
})
