import {describe, expect, it, vi} from 'vitest'
import {NextRequest} from 'next/server'
import {normalizeInternalDestination, stripLegacyLocale} from '@/server/http/locale'

vi.mock('@clerk/nextjs/server', () => ({clerkMiddleware: (handler: unknown) => handler}))
import proxy from '@/proxy'

describe('historical route compatibility', () => {
  it.each(['/en', '/es', '/en/', '/es/'])('normalizes historical home %s', path => {
    expect(stripLegacyLocale(path)).toBe('/')
  })
  it.each(['/en/messages/letter-1?returnTo=%2Fes%23map', '/es/my-messages?cursor=older%2Bpage'])('redirects with 307 and preserves resource and query %s', href => {
    const request = new NextRequest(`https://atiny.test${href}`)
    const response = (proxy as unknown as (_auth: unknown, request: NextRequest) => Response)({}, request)
    expect(response.status).toBe(307)
    const target = new URL(response.headers.get('location')!)
    expect(target.pathname).toBe(stripLegacyLocale(request.nextUrl.pathname))
    expect(target.search).toBe(request.nextUrl.search)
  })
  it.each(['/', '/messages/letter-1', '/api/map/messages'])('does not add locale to %s', path => {
    const response = (proxy as unknown as (_auth: unknown, request: NextRequest) => Response)({}, new NextRequest(`https://atiny.test${path}`))
    expect(response.headers.get('location')).toBeNull()
  })
  it.each(['//evil.test', '/es/../messages/new', '/messages/%2e%2e/new', '/es\\evil', '/es/messages/new\n'])('rejects normalization attacks %s', input => {
    expect(normalizeInternalDestination(input)).toBeUndefined()
  })
})
