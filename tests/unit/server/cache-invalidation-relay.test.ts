import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { invalidateGeographicReads, invalidatePublicReads, invalidateLocalCacheGroups } from '@/server/cache'
import { relayCacheInvalidation } from '@/server/cache/invalidation-relay'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), warn: vi.fn(), info: vi.fn(), expire: vi.fn(), set: vi.fn(), adapter: vi.fn() }))
vi.mock('@/server/cache/vercel-cache', () => ({ createVercelCache: mocks.adapter }))
vi.mock('@/server/observability/logger', () => ({ createLogger: () => ({ info: mocks.info, warn: mocks.warn }) }))
const secret = 'a-shared-invalidation-secret-with-32-characters'
const destination = 'https://production.example/api/internal/cache/invalidate'
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }))
  mocks.set.mockResolvedValue(undefined); mocks.expire.mockResolvedValue(undefined)
  mocks.adapter.mockReturnValue({ get: vi.fn(), set: mocks.set, invalidate: mocks.expire })
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_PROJECT_ID', 'project')
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'false')
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_URL', destination)
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', secret)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it.each(['preview', 'development', ''])('forwards %s postcommit invalidation even with reads disabled', async environment => {
  vi.stubEnv('VERCEL_ENV', environment)
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  await expect(invalidateGeographicReads()).resolves.toBeUndefined()
  expect(mocks.adapter).not.toHaveBeenCalled()
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
  expect(mocks.fetch).toHaveBeenNthCalledWith(1, destination, expect.objectContaining({
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ groups: ['options', 'stats'] }), redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal),
  }))
  expect(mocks.fetch.mock.calls[1][1].body).toBe(JSON.stringify({ groups: ['geography'] }))
})
it('invalidates Production locally and never loops to the relay', async () => {
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true')
  await invalidatePublicReads()
  expect(mocks.expire).toHaveBeenCalledTimes(2)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('acknowledges disabled Production without touching provider and distinguishes initialization failure', async () => {
  vi.stubEnv('VERCEL_ENV', 'production')
  expect(await invalidateLocalCacheGroups(['stats'])).toBe(true)
  expect(mocks.adapter).not.toHaveBeenCalled()
  vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true')
  mocks.adapter.mockImplementation(() => { throw new Error('provider payload') })
  expect(await invalidateLocalCacheGroups(['stats'])).toBe(false)
})
it('returns failure if provider invalidation fails while successful mutation API stays void', async () => {
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true')
  mocks.expire.mockRejectedValue(new Error('private provider body'))
  expect(await invalidateLocalCacheGroups(['options', 'stats'])).toBe(false)
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
})
it.each(['', 'http://production.example/api/internal/cache/invalidate', 'https://user:password@production.example/api/internal/cache/invalidate', `${destination}#private`, 'not a url'])('rejects absent or unsafe relay destination without a network call: %s', async url => {
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_URL', url)
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.warn).toHaveBeenCalled()
})
it.each(['', 'short', 'invalid\nsecret-value-that-is-long-enough-for-validation'])('rejects missing or invalid server secret before networking', async value => {
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', value)
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('bounds timeout to two seconds and never logs secret, URL, HTTP bodies or raw exceptions', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  mocks.fetch.mockResolvedValueOnce(new Response('private provider body', { status: 503 }))
    .mockRejectedValueOnce(new Error(`private response ${secret} ${destination}`))
  await relayCacheInvalidation(['options'])
  await relayCacheInvalidation(['geography'])
  expect(timeout).toHaveBeenCalledWith(2000)
  expect(mocks.warn).toHaveBeenCalledWith('cache_invalidation_relay', { outcome: 'http_error' })
  expect(mocks.warn).toHaveBeenCalledWith('cache_invalidation_relay', { outcome: 'request_error' })
  const logs = JSON.stringify(mocks.warn.mock.calls)
  for (const sensitive of [secret, destination, 'private response', 'private provider body']) expect(logs).not.toContain(sensitive)
  timeout.mockRestore()
})
it('treats timeouts and redirects as failed invalidation without failing the writer', async () => {
  mocks.fetch.mockRejectedValueOnce(new DOMException('private', 'TimeoutError')).mockRejectedValueOnce(new TypeError('redirect'))
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  expect(mocks.warn).toHaveBeenCalledWith('cache_invalidation_relay', { outcome: 'timeout' })
})

it('fails local invalidation when caching is enabled without project identity', async () => {
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('PUBLIC_READ_CACHE_ENABLED', 'true')
  vi.stubEnv('VERCEL_PROJECT_ID', '')
  expect(await invalidateLocalCacheGroups(['stats'])).toBe(false)
  expect(mocks.adapter).not.toHaveBeenCalled()
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('leaves default unconfigured local writers usable without any network request', async () => {
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_URL', ''); vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', '')
  await expect(invalidatePublicReads()).resolves.toBeUndefined()
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.warn).toHaveBeenCalledWith('cache_invalidation_relay', { outcome: 'missing_configuration' })
})
