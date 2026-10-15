import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReadCache, cacheConfig, type CacheProvider } from '@/server/cache/read-cache'

vi.mock('@/server/observability/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }))

class SharedCache implements CacheProvider {
  now = 0
  values = new Map<string, { value: unknown; until: number; tags: string[] }>()
  async get(key: string) { const item = this.values.get(key); return item && item.until > this.now ? structuredClone(item.value) : null }
  async set(key: string, value: unknown, ttl: number, tags: string[]) { this.values.set(key, { value: structuredClone(value), until: this.now + ttl, tags }) }
  async invalidate(tags: string[]) { for (const [key, item] of this.values) if (item.tags.some(tag => tags.includes(tag))) this.values.delete(key) }
}
const config = { namespace: 'project:preview', ttl: { geography: 24, options: 5, stats: 1 } }
const valid = (value: unknown): value is number => typeof value === 'number'
let provider: SharedCache
beforeEach(() => { provider = new SharedCache() })

describe('shared optional read cache', () => {
  it('shares plain values between independent clients and expires configured TTL', async () => {
    const a = createReadCache(provider, config), b = createReadCache(provider, config)
    const load = vi.fn().mockResolvedValue(12)
    expect(await a.read('stats', ['totals'], valid, load)).toBe(12)
    expect(await b.read('stats', ['totals'], valid, load)).toBe(12)
    expect(load).toHaveBeenCalledTimes(1)
    provider.now = 2
    await b.read('stats', ['totals'], valid, load)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('isolates projects, environments, groups and all key parameters', async () => {
    const a = createReadCache(provider, config)
    const b = createReadCache(provider, { ...config, namespace: 'project:production' })
    const c = createReadCache(provider, { ...config, namespace: 'another:preview' })
    const load = vi.fn().mockResolvedValue(1)
    for (const client of [a, b, c]) await client.read('geography', ['city', 'paris', 'fr'], valid, load)
    await a.read('geography', ['city', 'paris', 'us'], valid, load)
    await a.read('options', ['city', 'paris', 'fr'], valid, load)
    expect(load).toHaveBeenCalledTimes(5)
  })
  it.each(['get', 'set', 'invalidate'] as const)('keeps DB results available on provider %s failure', async method => {
    const cache = createReadCache(provider, config)
    vi.spyOn(provider, method).mockRejectedValue(new Error('private provider payload'))
    await expect(cache.invalidate(['stats'])).resolves.toBeUndefined()
    await expect(cache.read('stats', ['totals'], valid, async () => 3)).resolves.toBe(3)
  })
  it('does not cache failed SQL or malformed entries', async () => {
    const cache = createReadCache(provider, config)
    const load = vi.fn().mockRejectedValueOnce(new Error('SQL')).mockResolvedValue(7)
    await expect(cache.read('stats', ['totals'], valid, load)).rejects.toThrow('SQL')
    await cache.read('stats', ['totals'], valid, load)
    const entry = [...provider.values.values()].find(item => typeof item.value === 'number')!
    entry.value = { content: 'invalid' }
    await cache.read('stats', ['totals'], valid, load)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('makes previous and late in-flight fills inaccessible after invalidation', async () => {
    const cache = createReadCache(provider, config)
    let finish!: (value: number) => void
    const oldRead = cache.read('stats', ['totals'], valid, () => new Promise<number>(resolve => { finish = resolve }))
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    await cache.invalidate(['stats'])
    finish(99)
    await oldRead
    expect(await cache.read('stats', ['totals'], valid, async () => 2)).toBe(2)
  })
  it('uses a fresh generation after eviction, never resurrecting old fills', async () => {
    const cache = createReadCache(provider, config)
    await cache.read('stats', ['totals'], valid, async () => 1)
    for (const key of provider.values.keys()) if (key.includes('generation')) provider.values.delete(key)
    expect(await cache.read('stats', ['totals'], valid, async () => 2)).toBe(2)
  })
  it('requires explicit opt-in, Vercel and complete isolation identity; validates TTL', () => {
    const env = { PUBLIC_READ_CACHE_ENABLED: 'true', VERCEL: '1', VERCEL_PROJECT_ID: 'prj', VERCEL_ENV: 'preview' }
    expect(cacheConfig({})).toBeNull()
    expect(cacheConfig({ ...env, VERCEL: '0' })).toBeNull()
    expect(cacheConfig({ ...env, VERCEL_PROJECT_ID: '' })).toBeNull()
    expect(cacheConfig({ ...env, PUBLIC_READ_CACHE_STATS_TTL_SECONDS: '-2' })?.ttl.stats).toBe(60)
    expect(cacheConfig({ ...env, PUBLIC_READ_CACHE_STATS_TTL_SECONDS: '23' })?.ttl.stats).toBe(23)
  })
})

it('rejects a hit if invalidation completes while the cached value is being fetched', async () => {
  const cache = createReadCache(provider, config)
  await cache.read('stats', ['totals'], valid, async () => 99)
  const originalGet = provider.get.bind(provider)
  let invalidateDuringRead = true
  vi.spyOn(provider, 'get').mockImplementation(async key => {
    const value = await originalGet(key)
    if (!key.includes(':generation:') && invalidateDuringRead) {
      invalidateDuringRead = false
      await cache.invalidate(['stats'])
    }
    return value
  })
  expect(await cache.read('stats', ['totals'], valid, async () => 2)).toBe(2)
})

it('does not resurrect stale data when a provider set finishes after invalidation', async () => {
  const cache = createReadCache(provider, config)
  const originalSet = provider.set.bind(provider)
  let completeSet!: () => void
  vi.spyOn(provider, 'set').mockImplementation(async (key, value, ttl, tags) => {
    if (value === 99) await new Promise<void>(resolve => { completeSet = resolve })
    await originalSet(key, value, ttl, tags)
  })
  const pending = cache.read('stats', ['totals'], valid, async () => 99)
  await vi.waitFor(() => expect(completeSet).toBeTypeOf('function'))
  await cache.invalidate(['stats'])
  completeSet(); await pending
  expect(await cache.read('stats', ['totals'], valid, async () => 2)).toBe(2)
})
