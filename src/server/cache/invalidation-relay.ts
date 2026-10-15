import type { CacheGroup } from './read-cache'
import { createLogger } from '@/server/observability/logger'

const logger = createLogger('public-read-cache')

/** Shared server secret, never a browser-visible or user-supplied value. */
export function validInvalidationSecret(value: string | undefined): value is string {
  return typeof value === 'string' && /^[\x21-\x7e]{32,256}$/.test(value)
}

/** A nonproduction writer has committed to the same DB that Production reads. */
export async function relayCacheInvalidation(groups: CacheGroup[]): Promise<void> {
  const destination = process.env.PUBLIC_READ_CACHE_INVALIDATION_URL
  const secret = process.env.PUBLIC_READ_CACHE_INVALIDATION_SECRET
  if (!destination || !secret) {
    logger.warn('cache_invalidation_relay', { outcome: 'missing_configuration' })
    return
  }
  let url: URL
  try {
    url = new URL(destination)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !validInvalidationSecret(secret)) throw new Error('Invalid configuration')
  } catch {
    logger.warn('cache_invalidation_relay', { outcome: 'invalid_configuration' })
    return
  }
  try {
    const response = await fetch(url.href, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ groups }),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2000),
    })
    // The endpoint has no application payload. Never read or log remote bodies.
    await response.body?.cancel()
    if (!response.ok) {
      logger.warn('cache_invalidation_relay', { outcome: 'http_error' })
      return
    }
    logger.info('cache_invalidation_relay', { outcome: 'success' })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    logger.warn('cache_invalidation_relay', { outcome: timeout ? 'timeout' : 'request_error' })
  }
}
