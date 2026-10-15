import 'server-only'
import { createHash } from 'node:crypto'
import { getCache, type RuntimeCache } from '@vercel/functions'
import type { CacheProvider } from './read-cache'

/** Only this adapter knows the provider SDK. Tags need explicit isolation too. */
export function createVercelCache(namespace: string): CacheProvider {
  // SDK 3.9.11 otherwise silently falls back to process memory (or its build
  // client, which suppresses failures). There is no public availability probe.
  // Keep this version-specific capability check inside the provider adapter.
  const context = globalThis as typeof globalThis & {
    [key: symbol]: { get?: () => { cache?: RuntimeCache } } | undefined
  }
  if (!context[Symbol.for('@vercel/request-context')]?.get?.().cache) {
    throw new Error('Shared runtime cache unavailable')
  }
  const cache = getCache({ namespace, keyHashFunction: key => createHash('sha256').update(key).digest('hex') })
  return {
    get: key => cache.get(key),
    set: async (key, value, ttl, tags) => { await cache.set(key, value, { ttl, tags, name: 'public-read' }) },
    invalidate: async tags => { await cache.expireTag(tags) },
  }
}
