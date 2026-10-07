import { afterEach, describe, expect, it, vi } from 'vitest'

import { signCursor, verifyCursor } from '../../../../src/server/messages/cursor'

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

it('rejects cursor suffixes and Unicode signatures while preserving issued cursors', () => {
  const payload = { id: 'message-1', publishedAt: '2026-10-07T10:00:00Z' }
  const cursor = signCursor(payload)
  expect(verifyCursor(cursor)).toEqual(payload)
  expect(verifyCursor(`${cursor}.extra`)).toBeNull()
  expect(verifyCursor(`${cursor.split('.')[0]}.${'é'.repeat(43)}`)).toBeNull()
})
