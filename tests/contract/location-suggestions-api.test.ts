import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createLocationSuggestionsPostHandler, POST } from '../../src/app/api/locations/suggestions/route'
import { GeoapifyProviderError } from '../../src/server/locations/geoapify'

function request(body: unknown) {
  return new Request('http://localhost/api/locations/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/locations/suggestions', () => {
  it('accepts only a body query of 2–200 characters, en/es/ko and a limit from 1 to 8', async () => {
    expect((await POST(request({ query: 'a', language: 'en', limit: 5 }))).status).toBe(400)
    expect((await POST(request({ query: 'Seoul', language: 'fr', limit: 5 }))).status).toBe(400)
    expect((await POST(request({ query: 'Seoul', language: 'en', limit: 9 }))).status).toBe(400)
  })

  it('defaults to five results and returns only public fields, opaque tokens and attribution', async () => {
    const search = vi.fn().mockResolvedValue([{
      locality: 'Seoul', country: 'South Korea', countryCode: 'kr',
      point: { latitude: 37.5665, longitude: 126.978 }, attribution: 'Geoapify',
    }])
    const handler = createLocationSuggestionsPostHandler({
      search,
      signSelection: () => 'opaque-selection-token',
    })

    const response = await handler(request({ query: 'Seoul', language: 'ko' }))

    expect(response.status).toBe(200)
    expect(search).toHaveBeenCalledWith({ query: 'Seoul', language: 'ko', limit: 5 })
    await expect(response.json()).resolves.toEqual({
      suggestions: [{
        locality: 'Seoul', country: 'South Korea', countryCode: 'kr',
        point: { latitude: 37.5665, longitude: 126.978 },
        sourceAttribution: { label: 'Geoapify', url: 'https://www.geoapify.com/' },
        selectionToken: 'opaque-selection-token',
      }],
      providerAttribution: { label: 'Geoapify', url: 'https://www.geoapify.com/' },
    })
  })

  it('maps provider quota and availability failures to stable, non-sensitive errors', async () => {
    const limited = createLocationSuggestionsPostHandler({
      search: async () => { throw new GeoapifyProviderError('rate_limited') },
      signSelection: () => 'unused',
    })
    const unavailable = createLocationSuggestionsPostHandler({
      search: async () => { throw new Error('Calle privada 123') },
      signSelection: () => 'unused',
    })

    const limitedResponse = await limited(request({ query: 'Seoul', language: 'ko' }))
    expect(limitedResponse.status).toBe(429)
    expect(limitedResponse.headers.get('retry-after')).toBe('60')
    await expect(limitedResponse.json()).resolves.toEqual({
      code: 'LOCATION_PROVIDER_UNAVAILABLE', messageKey: 'location.providerRateLimited', retryAfterSeconds: 60,
    })

    const unavailableResponse = await unavailable(request({ query: 'Seoul', language: 'ko' }))
    expect(unavailableResponse.status).toBe(502)
    await expect(unavailableResponse.json()).resolves.toEqual({
      code: 'LOCATION_PROVIDER_UNAVAILABLE', messageKey: 'location.providerUnavailable',
    })
  })

  it('rate limits the same client locally before calling the provider', async () => {
    const search = vi.fn().mockResolvedValue([])
    const handler = createLocationSuggestionsPostHandler({
      search,
      signSelection: () => 'unused',
      rateLimiter: (() => {
        let attempts = 0
        return () => ({ allowed: ++attempts <= 2, retryAfterSeconds: 60 })
      })(),
    })

    await expect(handler(request({ query: 'Seoul', language: 'ko' }))).resolves.toMatchObject({ status: 200 })
    await expect(handler(request({ query: 'Seoul', language: 'ko' }))).resolves.toMatchObject({ status: 200 })
    const response = await handler(request({ query: 'Seoul', language: 'ko' }))

    expect(response.status).toBe(429)
    expect(search).toHaveBeenCalledTimes(2)
    await expect(response.json()).resolves.toEqual({
      code: 'LOCATION_PROVIDER_UNAVAILABLE', messageKey: 'location.rateLimited', retryAfterSeconds: 60,
    })
  })
})
