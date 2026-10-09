import { afterEach, describe, expect, it, vi } from 'vitest'

const { attach } = vi.hoisted(() => ({ attach: vi.fn() }))
vi.mock('@vercel/functions', () => ({ attachDatabasePool: attach }))
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('runtime pool routing', () => {
  it.each([
    ['aws-1-eu-west-3.pooler.supabase.com:5432', 5432],
    ['aws-1-eu-west-3.pooler.supabase.com', 5432],
    ['aws-1-eu-west-3.pooler.supabase.com:6543', 6543],
    ['127.0.0.1:54322', 54322],
    ['db.project.supabase.co:5432', 5432],
  ])('preserves the explicitly configured endpoint %s', async (host, expectedPort) => {
    const { createDatabase } = await import('@/server/db/client')
    const url = `postgresql://app:p%40ss@${host}/postgres`
    const { sql, pool } = createDatabase(url)
    try {
      expect(pool.options.connectionString).toBe(url)
      expect(Number(new URL(pool.options.connectionString!).port || 5432)).toBe(expectedPort)
      expect(pool.options.max).toBe(1)
      expect(pool.options.pipeline).toBe(false)
      expect(pool.options.idleTimeoutMillis).toBe(20_000)
      expect(pool.options.connectionTimeoutMillis).toBe(10_000)
      expect(pool.options.options).toBe('-c search_path=extensions,public')
      expect(pool.options.ssl).toEqual(host.startsWith('127.') ? false : { rejectUnauthorized: false })
    } finally { await sql.end() }
  })

  it.each(['1', ''])('attaches the singleton to the Vercel lifecycle only on Vercel=%s', async vercel => {
    vi.resetModules()
    vi.stubEnv('VERCEL', vercel)
    vi.stubEnv('DATABASE_URL', 'postgresql://app:password@localhost:54322/postgres')
    const { getDb } = await import('@/server/db/client')
    const db = getDb()
    expect(getDb()).toBe(db)
    expect(attach).toHaveBeenCalledTimes(vercel === '1' ? 1 : 0)
    await db.end()
  })
})
