import { describe, expect, it } from 'vitest'

import { getDatabaseUrl } from '../../../src/server/env'

describe('getDatabaseUrl', () => {
  it('rejects a missing database URL', () => {
    expect(() => getDatabaseUrl({})).toThrowError(
      'DATABASE_URL is required on the server',
    )
  })

  it('returns the configured database URL', () => {
    const databaseUrl = 'postgresql://user:password@database.example/app'

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl)
  })
})
