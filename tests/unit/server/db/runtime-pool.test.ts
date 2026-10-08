import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllEnvs())

describe('runtime pool routing', () => {
  it.each([
    ['aws-1-eu-west-3.pooler.supabase.com:5432', true, 6543],
    ['aws-1-eu-west-3.pooler.supabase.com', true, 6543],
    ['aws-1-eu-west-3.pooler.supabase.com:6543', true, 6543],
    ['aws-1-eu-west-3.pooler.supabase.com:5432', false, 5432],
    ['127.0.0.1:54322', true, 54322],
    ['db.project.supabase.co:5432', true, 5432],
    ['pooler.supabase.com.example.org:5432', true, 5432],
  ])('connects %s on Vercel=%s using port %s', async (host, vercel, expectedPort) => {
    vi.resetModules()
    vi.stubEnv('VERCEL', vercel ? '1' : '')
    vi.stubEnv('DATABASE_URL', `postgresql://app:p%40ss@${host}/postgres?application_name=runtime-test`)
    const { getDb } = await import('@/server/db/client')
    const db = getDb()
    try {
      expect(db.options.port).toEqual([expectedPort])
      expect(db.options.user).toBe('app')
      expect(db.options.database).toBe('postgres')
      expect(db.options.prepare).toBe(false)
    } finally {
      await db.end()
    }
  })
})
