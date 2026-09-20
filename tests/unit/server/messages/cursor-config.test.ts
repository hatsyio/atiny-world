import { afterEach, describe, expect, it, vi } from 'vitest'

import { signCursor } from '../../../../src/server/messages/cursor'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('cursor signing configuration', () => {
  it('requires a stable key in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CURSOR_SECRET', '')
    expect(() => signCursor({ id: '1' })).toThrow('CURSOR_SECRET')
  })

  it('allows an ephemeral key in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CURSOR_SECRET', '')
    expect(signCursor({ id: '1' })).toContain('.')
  })
})
