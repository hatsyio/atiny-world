import { afterEach, expect, it, vi } from 'vitest'
import { createVercelCache } from '@/server/cache/vercel-cache'

const sdk = vi.hoisted(() => ({ getCache: vi.fn(), get: vi.fn(), set: vi.fn(), expireTag: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@vercel/functions', () => ({ getCache: sdk.getCache }))
const symbol = Symbol.for('@vercel/request-context')
const context = globalThis as typeof globalThis & Record<symbol, unknown>
const previous = context[symbol]
afterEach(() => { if (previous === undefined) delete context[symbol]; else context[symbol] = previous; vi.clearAllMocks() })
it('refuses SDK memory/build fallbacks when no shared request cache is available', () => {
  delete context[symbol]
  expect(() => createVercelCache('isolated')).toThrow('Shared runtime cache unavailable')
  expect(sdk.getCache).not.toHaveBeenCalled()
})
it('uses SHA256 keys, explicit namespace, TTL, tags and immediate expiration', async () => {
  context[symbol] = { get: () => ({ cache: {} }) }
  sdk.getCache.mockReturnValue({ get: sdk.get, set: sdk.set, expireTag: sdk.expireTag })
  const provider = createVercelCache('isolated')
  const options = sdk.getCache.mock.calls[0][0]
  expect(options.namespace).toBe('isolated')
  expect(options.keyHashFunction('a')).toMatch(/^[a-f0-9]{64}$/)
  expect(options.keyHashFunction('a')).not.toBe(options.keyHashFunction('b'))
  await provider.set('key', { letters: 2 }, 60, ['isolated:stats'])
  expect(sdk.set).toHaveBeenCalledWith('key', { letters: 2 }, { ttl: 60, tags: ['isolated:stats'], name: 'public-read' })
  await provider.invalidate(['isolated:stats'])
  expect(sdk.expireTag).toHaveBeenCalledWith(['isolated:stats'])
})
