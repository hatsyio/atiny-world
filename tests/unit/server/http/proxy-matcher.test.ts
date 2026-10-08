import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware: (handler: unknown) => handler }))
import { config } from '@/proxy'

describe('Clerk proxy coverage', () => {
  it.each(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/favicon.png', '/assets/js/auth.js', '/missing.css', '/', '/messages/letter-id', '/api/map/messages'])('provides auth context when %s can render the root layout', url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  })

  it.each(['/_next/static/chunks/app.js', '/_next/image?url=%2Fimages%2Fnautical-desk.png&w=640&q=75'])('skips Next internals %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })
})
