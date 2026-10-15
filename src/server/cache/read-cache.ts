import { createHash, randomUUID } from 'node:crypto'
import { createLogger } from '@/server/observability/logger'

export type CacheGroup = 'geography' | 'options' | 'stats'
export interface CacheProvider {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, ttl: number, tags: string[]): Promise<void>
  invalidate(tags: string[]): Promise<void>
}
export interface ReadCacheConfig { namespace: string; ttl: Record<CacheGroup, number> }
const logger = createLogger('public-read-cache')

export function cacheConfig(env: Record<string, string | undefined>): ReadCacheConfig | null {
  if (env.PUBLIC_READ_CACHE_ENABLED !== 'true' || env.VERCEL !== '1' || !env.VERCEL_PROJECT_ID || !env.VERCEL_ENV) return null
  const ttl = (name: string, fallback: number) => {
    const raw = env[name]
    const value = raw && /^\d+$/.test(raw) ? Number(raw) : NaN
    return Number.isSafeInteger(value) && value > 0 ? value : fallback
  }
  return {
    namespace: `atiny:v1:${createHash('sha256').update(JSON.stringify([env.VERCEL_PROJECT_ID, env.VERCEL_ENV, env.VERCEL_TARGET_ENV ?? env.VERCEL_ENV])).digest('hex')}`,
    ttl: {
      geography: ttl('PUBLIC_READ_CACHE_GEOGRAPHY_TTL_SECONDS', 86400),
      options: ttl('PUBLIC_READ_CACHE_OPTIONS_TTL_SECONDS', 300),
      stats: ttl('PUBLIC_READ_CACHE_STATS_TTL_SECONDS', 60),
    },
  }
}

export function createReadCache(provider: CacheProvider, config: ReadCacheConfig) {
  const generationKey = (group: CacheGroup) => `${config.namespace}:generation:${group}`
  const tag = (group: CacheGroup) => `${config.namespace}:${group}`
  // Generation entries carry no data tags: expiration must not remove the new fence.
  // A new random token on eviction prevents any old in-flight fill from reappearing.
  const generation = async (group: CacheGroup): Promise<string> => {
    const current = await provider.get(generationKey(group))
    if (typeof current === 'string' && /^[0-9a-f-]{36}$/.test(current)) return current
    const fresh = randomUUID()
    await provider.set(generationKey(group), fresh, Math.max(...Object.values(config.ttl)), [])
    return fresh
  }
  return {
    async read<T>(group: CacheGroup, parameters: unknown[], validate: (value: unknown) => value is T, load: () => Promise<T>): Promise<T> {
      let key: string | undefined
      try {
        const version = await generation(group)
        key = `${config.namespace}:${group}:${version}:${createHash('sha256').update(JSON.stringify(parameters)).digest('hex')}`
        const entry = await provider.get(key)
        if (validate(entry) && await provider.get(generationKey(group)) === version) {
          logger.info('cache_read', { group, outcome: 'hit' })
          return entry
        }
        logger.info('cache_read', { group, outcome: 'miss' })
      } catch {
        key = undefined
        logger.warn('cache_error', { group, outcome: 'read_error' })
      }
      logger.info('cache_read', { group, outcome: 'db_load' })
      // SQL errors propagate, and are never stored as successful results.
      const result = await load()
      if (key && validate(result)) {
        try { await provider.set(key, result, config.ttl[group], [tag(group)]) }
        catch { logger.warn('cache_error', { group, outcome: 'write_error' }) }
      }
      return result
    },
    async invalidate(groups: CacheGroup[]): Promise<void> {
      for (const group of groups) {
        try {
          await provider.set(generationKey(group), randomUUID(), Math.max(...Object.values(config.ttl)), [])
          await provider.invalidate([tag(group)])
          logger.info('cache_invalidation', { group, outcome: 'success' })
        } catch { logger.warn('cache_error', { group, outcome: 'invalidation_error' }) }
      }
    },
  }
}
