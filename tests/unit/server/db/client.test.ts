import { describe, expect, it } from 'vitest'

import { isLocalDatabase } from '../../../../src/server/db/client'

describe('isLocalDatabase', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'db'])(
    'recognizes %s as a local database hostname',
    (hostname) => {
      expect(isLocalDatabase(`postgresql://postgres:postgres@${hostname}:5432/postgres`)).toBe(
        true,
      )
    },
  )

  it('does not disable TLS for a remote database', () => {
    expect(
      isLocalDatabase('postgresql://user:password@database.example/postgres'),
    ).toBe(false)
  })
})
