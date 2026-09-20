import { describe, expect, it } from 'vitest'

import { getDatabaseUrl, validateRuntimeEnvironment } from '../../../src/server/env'

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

describe('validateRuntimeEnvironment', () => {
  const complete = {
    DATABASE_URL: 'postgresql://user:password@database.example/app',
    CLERK_SECRET_KEY: 'clerk-secret',
    GEOAPIFY_API_KEY: 'geoapify-key',
    LOCATION_SELECTION_SECRET: 'location-secret',
    CURSOR_SECRET: 'cursor-secret',
    NEXT_PUBLIC_CARTO_BASEMAP_KEY: 'carto-key',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'clerk-public',
  }

  it('accepts a complete production environment', () => {
    expect(() => validateRuntimeEnvironment(complete, 'production')).not.toThrow()
  })

  it('rejects missing production secrets and public keys', () => {
    for (const key of Object.keys(complete)) {
      const environment = { ...complete, [key]: undefined }
      expect(() => validateRuntimeEnvironment(environment, 'production')).toThrow(key)
    }
  })

  it('allows optional service keys in development', () => {
    expect(() => validateRuntimeEnvironment({ DATABASE_URL: complete.DATABASE_URL }, 'development')).not.toThrow()
  })
})
