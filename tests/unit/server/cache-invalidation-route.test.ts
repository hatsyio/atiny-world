import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/internal/cache/invalidate/route'

const local = vi.hoisted(() => vi.fn())
vi.mock('@/server/cache', () => ({ invalidateLocalCacheGroups: local }))
vi.mock('@/server/observability/logger', () => ({ createLogger: () => ({ warn: vi.fn(), info: vi.fn() }) }))
const secret = 'a-shared-invalidation-secret-with-32-characters'
function request(body: unknown = { groups: ['options', 'stats'] }, auth: string | null = `Bearer ${secret}`, extra: HeadersInit = {}) {
  const headers = new Headers({ 'content-type': 'application/json', ...extra })
  if (auth !== null) headers.set('authorization', auth)
  return new Request('https://production.example/api/internal/cache/invalidate', { method: 'POST', headers, body: JSON.stringify(body) })
}
beforeEach(() => {
  vi.clearAllMocks(); local.mockResolvedValue(true)
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', secret)
})
afterEach(() => vi.unstubAllEnvs())
it('authenticates and forwards only allowlisted groups to local invalidation', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ ok: true })
  expect(local).toHaveBeenCalledExactlyOnceWith(['options', 'stats'])
})
it.each(['preview', 'development', ''])('is unavailable in %s regardless of valid authentication', async environment => {
  vi.stubEnv('VERCEL_ENV', environment)
  expect((await POST(request())).status).toBe(404)
  expect(local).not.toHaveBeenCalled()
})
it.each([null, '', 'Bearer wrong-value', `Basic ${secret}`, `Bearer ${secret}extra`])('rejects unauthorized requests before body or cache access', async auth => {
  expect((await POST(request({ groups: ['geography'] }, auth))).status).toBe(401)
  expect(local).not.toHaveBeenCalled()
})
it.each(['', 'weak', 'invalid secret with whitespace but enough length'])('fails closed with an unconfigured or invalid receiver secret', async value => {
  vi.stubEnv('PUBLIC_READ_CACHE_INVALIDATION_SECRET', value)
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain(secret)
  expect(local).not.toHaveBeenCalled()
})
it.each([
  {}, [], { groups: [] }, { groups: ['arbitrary'] }, { groups: ['stats', 'stats'] },
  { groups: ['stats', 'options', 'geography', 'stats'] }, { groups: 'stats' },
  { groups: ['stats'], tags: ['arbitrary'] }, { groups: ['stats'], content: 'private content' },
])('rejects invalid groups, duplicates and arbitrary fields', async body => {
  expect((await POST(request(body))).status).toBe(400)
  expect(local).not.toHaveBeenCalled()
})
it('rejects a body larger than 1024 bytes by declaration before reading it', async () => {
  expect((await POST(request({}, `Bearer ${secret}`, { 'content-length': '1025' }))).status).toBe(413)
  expect(local).not.toHaveBeenCalled()
})
it('bounds streamed bytes even without content-length', async () => {
  const cancel = vi.fn()
  const stream = new ReadableStream({ start: controller => controller.enqueue(new Uint8Array(1025)), cancel })
  const incoming = new Request('https://production.example/api/internal/cache/invalidate', {
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: stream, ...{ duplex: 'half' },
  })
  expect((await POST(incoming)).status).toBe(413)
  expect(cancel).toHaveBeenCalled()
  expect(local).not.toHaveBeenCalled()
})
it('handles malformed JSON and wrong content type without invoking cache', async () => {
  const incoming = new Request('https://production.example/api/internal/cache/invalidate', { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: '{' })
  expect((await POST(incoming)).status).toBe(400)
  expect((await POST(request({}, `Bearer ${secret}`, { 'content-type': 'text/plain' }))).status).toBe(415)
  expect(local).not.toHaveBeenCalled()
})
it('does not claim completed invalidation if local initialization or provider failed', async () => {
  local.mockResolvedValue(false)
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'Cache invalidation unavailable' })
})

it('handles an unexpected local-provider rejection without leaking its payload', async () => {
  local.mockRejectedValue(new Error(`private provider body ${secret}`))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain(secret)
})
