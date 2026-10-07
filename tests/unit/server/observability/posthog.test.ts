import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  capture: vi.fn(), captureException: vi.fn(), flush: vi.fn(),
  headers: vi.fn(), pending: [] as Array<() => Promise<void>>,
}))
vi.mock('posthog-node', () => ({ PostHog: class {
  capture = fake.capture
  captureException = fake.captureException
  flush = fake.flush
} }))
vi.mock('next/headers', () => ({ headers: fake.headers }))
vi.mock('next/server', () => ({ after: (work: () => Promise<void>) => fake.pending.push(work) }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  fake.pending.length = 0
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-project-token')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
  fake.headers.mockResolvedValue(new Headers())
  fake.flush.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('PostHog delivery', () => {
  it('defers network delivery until after the application response', async () => {
    const { captureServerEvent } = await import('@/server/observability/posthog')
    await captureServerEvent('user-1', 'message_published')
    expect(fake.flush).not.toHaveBeenCalled()
    expect(fake.pending).toHaveLength(1)
    await fake.pending[0]()
    expect(fake.flush).toHaveBeenCalledOnce()
  })
  it('does not fail an application action when request context is unavailable', async () => {
    fake.headers.mockRejectedValue(new Error('no request context'))
    const { captureServerEvent } = await import('@/server/observability/posthog')
    await expect(captureServerEvent('user-1', 'message_published')).resolves.toBeUndefined()
  })
  it('captures server errors without forwarding request secrets or query parameters', async () => {
    const { onRequestError } = await import('@/instrumentation')
    const error = new Error('database unavailable')
    await onRequestError(error, {
      path: '/api/map/features?token=private#secret', method: 'GET',
      headers: { cookie: 'private-cookie', authorization: 'Bearer private-token' },
    }, { routerKind: 'App Router', routePath: '/api/map/features', routeType: 'route', revalidateReason: undefined })
    expect(fake.captureException).toHaveBeenCalledWith(error, undefined, {
      $pathname: '/api/map/features', request_method: 'GET',
      route: '/api/map/features', route_type: 'route',
    })
    fake.flush.mockRejectedValue(new Error('PostHog unavailable'))
    await expect(fake.pending[0]()).resolves.toBeUndefined()
  })
})
