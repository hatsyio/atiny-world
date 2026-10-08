import { afterAll, describe, expect, it } from 'vitest'

import { getDb } from '../../src/server/db/client'
import { checkDatabaseHealth } from '../../src/server/db/health'

describe('database health integration', () => {
  afterAll(async () => {
    await getDb().end()
  })

  it('queries the configured PostgreSQL database', async () => {
    await expect(checkDatabaseHealth()).resolves.toEqual({ database: 'ok' })
  })

  it('completes concurrent health probes, parameterized reads and transactions', async () => {
    const db = getDb()
    const operations = Array.from({ length: 12 }, (_, index) => {
      if (index % 3 === 0) return checkDatabaseHealth()
      if (index % 3 === 1) return db`select ${index}::int as value`
      return db.begin((tx) => tx`select ${index}::int as value`)
    })
    await expect(Promise.all(operations)).resolves.toHaveLength(12)
  }, 10_000)

  it('releases an idle connection and reconnects for the next query', async () => {
    const db = getDb()
    const [before] = await db<{ pid: number }[]>`select pg_backend_pid() as pid`
    await new Promise((resolve) => setTimeout(resolve, 21_500))
    const [after] = await db<{ pid: number }[]>`select pg_backend_pid() as pid`
    expect(after.pid).not.toBe(before.pid)
    await expect(checkDatabaseHealth()).resolves.toEqual({ database: 'ok' })
  }, 30_000)
})
