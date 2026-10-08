import { afterEach, describe, expect, it, vi } from 'vitest'

import { signCursor, verifyCursor } from '../../../../src/server/messages/cursor'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('cursor signing configuration', () => {
  it('requires a stable key in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CURSOR_SECRET', '')
    await expect(signCursor({ id: '1' })).rejects.toThrow('CURSOR_SECRET')
  })

  it('allows an ephemeral key in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('CURSOR_SECRET', '')
    expect(await signCursor({ id: '1' })).toContain('.')
  })
})

it('rejects cursor suffixes and Unicode signatures while preserving issued cursors', async () => {
  const payload = { id: '123', publishedAt: '2026-10-07T10:00:00Z' }
  const cursor = await signCursor(payload)
  expect(await verifyCursor(cursor)).toEqual(payload)
  expect(await verifyCursor(`${cursor}.extra`)).toBeNull()
  expect(await verifyCursor(`${cursor.split('.')[0]}.${'é'.repeat(43)}`)).toBeNull()
})
