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

  it('releases an idle connection and reconnects for the next query', async () => {
    const db = getDb()
    const [before] = await db<{ pid: number }[]>`select pg_backend_pid() as pid`
    await new Promise((resolve) => setTimeout(resolve, 21_500))
    const [after] = await db<{ pid: number }[]>`select pg_backend_pid() as pid`
    expect(after.pid).not.toBe(before.pid)
    await expect(checkDatabaseHealth()).resolves.toEqual({ database: 'ok' })
  }, 30_000)
})
