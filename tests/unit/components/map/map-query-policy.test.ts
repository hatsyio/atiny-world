import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { mapFeaturesQuery, publicMessageQuery } from '@/components/map/map-queries'

afterEach(() => { vi.unstubAllGlobals() })
it.each([400, 401, 403, 404, 409, 429])('does not automatically retry HTTP %s', async status => {
  const fetch = vi.fn(async () => new Response(null, { status }))
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient()
  await expect(client.fetchQuery(publicMessageQuery('letter-1'))).rejects.toThrow()
  expect(fetch).toHaveBeenCalledTimes(1)
  client.clear()
})
it('retries a temporary server failure once and preserves the resulting viewport data', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ features: [] })))
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient()
  expect(await client.fetchQuery({ ...mapFeaturesQuery('/api/map/features'), retryDelay: 0 })).toEqual({ features: [] })
  expect(fetch).toHaveBeenCalledTimes(2)
  client.clear()
})
it('deduplicates concurrent requests without retaining inactive public content', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ features: [] })))
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient()
  const options = mapFeaturesQuery('/api/map/features')
  await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])
  expect(fetch).toHaveBeenCalledTimes(1)
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(client.getQueryData(options.queryKey)).toBeUndefined()
  client.clear()
})
