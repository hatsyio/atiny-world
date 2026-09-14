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
})
