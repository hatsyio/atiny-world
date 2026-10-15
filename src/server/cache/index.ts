import { cacheConfig, createReadCache, isProductionCacheEnvironment, type CacheGroup } from './read-cache'
import { relayCacheInvalidation } from './invalidation-relay'
import { createLogger } from '@/server/observability/logger'

const logger = createLogger('public-read-cache')
async function configuredCache() {
  const config = cacheConfig(process.env)
  if (!config) return null
  try {
    const { createVercelCache } = await import('./vercel-cache')
    return createReadCache(createVercelCache(config.namespace), config)
  }
  catch { logger.warn('cache_error', { outcome: 'initialization_error' }); return null }
}
export async function cachedPublicRead<T>(group: CacheGroup, parameters: unknown[], validate: (value: unknown) => value is T, load: () => Promise<T>): Promise<T> {
  const cache = await configuredCache()
  return cache ? cache.read(group, parameters, validate, load) : load()
}

/** Receiver-only operation: it never forwards to another deployment. */
export async function invalidateLocalCacheGroups(groups: CacheGroup[]): Promise<boolean> {
  if (!isProductionCacheEnvironment()) return false
  if (process.env.PUBLIC_READ_CACHE_ENABLED !== 'true') return true
  const cache = await configuredCache()
  if (!cache) {
    logger.warn('cache_error', { outcome: 'invalidation_unavailable' })
    return false
  }
  return cache.invalidate(groups)
}

async function invalidateAfterCommit(groups: CacheGroup[]): Promise<void> {
  if (isProductionCacheEnvironment()) await invalidateLocalCacheGroups(groups)
  else await relayCacheInvalidation(groups)
}
export async function invalidatePublicReads(): Promise<void> {
  await invalidateAfterCommit(['options', 'stats'])
}
export async function invalidateGeographicReads(): Promise<void> {
  await invalidateAfterCommit(['geography'])
}
