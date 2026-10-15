import { cacheConfig, createReadCache, type CacheGroup } from './read-cache'
import { createLogger } from '@/server/observability/logger'

async function configuredCache() {
  const config = cacheConfig(process.env)
  if (!config) return null
  try {
    const { createVercelCache } = await import('./vercel-cache')
    return createReadCache(createVercelCache(config.namespace), config)
  }
  catch { createLogger('public-read-cache').warn('cache_error', { outcome: 'initialization_error' }); return null }
}
export async function cachedPublicRead<T>(group: CacheGroup, parameters: unknown[], validate: (value: unknown) => value is T, load: () => Promise<T>): Promise<T> {
  const cache = await configuredCache()
  return cache ? cache.read(group, parameters, validate, load) : load()
}
export async function invalidatePublicReads(): Promise<void> {
  await (await configuredCache())?.invalidate(['options', 'stats'])
}
export async function invalidateGeographicReads(): Promise<void> {
  await (await configuredCache())?.invalidate(['geography'])
}
