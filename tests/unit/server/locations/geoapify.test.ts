import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GeoapifyProviderError, searchGeoapifyLocations } from '../../../../src/server/locations/geoapify'

const providerPayload = {
  results: [
    {
      formatted: 'Calle de Alcalá, Madrid, España',
      address_line1: 'Calle de Alcalá',
      address_line2: 'Madrid, España',
      city: 'Madrid',
      country: 'Spain',
      country_code: 'es',
      lat: 40.4168,
      lon: -3.7038,
      result_type: 'street',
      datasource: { sourcename: 'openstreetmap' },
    },
  ],
}

describe('Geoapify location autocomplete', () => {
  it('sends an unbiased backend request and allowlists its public suggestion fields', async () => {
    const providerFetch = vi.fn<typeof fetch>()
    providerFetch.mockResolvedValue(new Response(JSON.stringify(providerPayload), { status: 200 }))

    const suggestions = await searchGeoapifyLocations(
      { query: 'Calle de Alcalá', language: 'es', limit: 1 },
      { apiKey: 'test-server-key', fetch: providerFetch },
    )

    const [url, init] = providerFetch.mock.calls[0] ?? []
    const request = new Request(url as RequestInfo, init)
    expect(request.url).toBe('https://api.geoapify.com/v1/geocode/autocomplete?text=Calle+de+Alcal%C3%A1&lang=es&limit=1&format=json&bias=countrycode%3Anone')
    expect(request.headers.get('x-api-key')).toBe('test-server-key')
    expect(suggestions).toEqual([{
      locality: 'Madrid',
      country: 'Spain',
      countryCode: 'es',
      point: { latitude: 40.4168, longitude: -3.7038 },
      attribution: 'Geoapify',
    }])
    expect(suggestions[0]).not.toHaveProperty('formatted')
    expect(suggestions[0]).not.toHaveProperty('address_line1')
  })

  it('maps quota exhaustion to the stable rate-limited provider outcome', async () => {
    await expect(searchGeoapifyLocations(
      { query: 'Madrid', language: 'es', limit: 1 },
      { apiKey: 'test-server-key', fetch: async () => new Response(null, { status: 429 }) },
    )).rejects.toMatchObject<Partial<GeoapifyProviderError>>({ outcome: 'rate_limited' })
  })

  it('maps an aborted upstream call to the stable unavailable provider outcome', async () => {
    const providerFetch = vi.fn<typeof fetch>()
    providerFetch.mockImplementation((_url, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))

    await expect(searchGeoapifyLocations(
      { query: 'Madrid', language: 'es', limit: 1 },
      { apiKey: 'test-server-key', fetch: providerFetch, timeoutMs: 1 },
    )).rejects.toMatchObject<Partial<GeoapifyProviderError>>({ outcome: 'unavailable' })
  })
})
