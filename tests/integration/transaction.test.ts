import { describe, expect, it } from 'vitest'

import { getDb } from '../../src/server/db/client'
import { runInTransaction } from '../../src/server/db/transaction'

describe('runInTransaction', () => {
  it('executes the callback inside a single Postgres transaction', async () => {
    const result = await runInTransaction(async (sql) => {
      const rows = await sql`select pg_current_xact_id() as txid`
      return rows[0]?.txid as string | undefined
    })

    expect(result).toBeDefined()
  })

  it('rolls back uncommitted writes on failure', async () => {
    const sql = getDb()

    await expect(
      runInTransaction(async (tx) => {
        await tx`
          insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name)
          values ('tx-rollback', 'tx-rollback', 'tx-rollback', 'Tx Rollback')
          on conflict do nothing
        `
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const rows = await sql`
      select 1 from app_private.profiles where clerk_user_id = 'tx-rollback'
    `
    expect(rows).toHaveLength(0)
  })
})
