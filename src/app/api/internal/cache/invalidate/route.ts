import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { invalidateLocalCacheGroups } from '@/server/cache'
import { CACHE_GROUPS, isProductionCacheEnvironment } from '@/server/cache/read-cache'
import { validInvalidationSecret } from '@/server/cache/invalidation-relay'
import { createLogger } from '@/server/observability/logger'

const logger = createLogger('public-read-cache')
const MAX_BODY_BYTES = 1024
const bodySchema = z.object({
  groups: z.array(z.enum(CACHE_GROUPS)).min(1).max(3).refine(groups => new Set(groups).size === groups.length),
}).strict()
const reply = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  if (!isProductionCacheEnvironment()) return reply(404, 'Not found')
  const secret = process.env.PUBLIC_READ_CACHE_INVALIDATION_SECRET
  if (!validInvalidationSecret(secret)) {
    logger.warn('cache_error', { outcome: 'receiver_configuration_error' })
    return reply(503, 'Cache invalidation unavailable')
  }
  // Hashes have equal length, so header length does not affect timingSafeEqual.
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest()
  const supplied = createHash('sha256').update(request.headers.get('authorization') ?? '').digest()
  if (!timingSafeEqual(expected, supplied)) return reply(401, 'Unauthorized')
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, 'Expected JSON')
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return reply(413, 'Request too large')

  const reader = request.body?.getReader()
  if (!reader) return reply(400, 'Invalid cache invalidation request')
  const chunks: Uint8Array[] = []
  let bytes = 0
  let body: unknown
  try {
    // Unlike request.text(), this limits accumulation before decoding/parsing.
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel()
        return reply(413, 'Request too large')
      }
      chunks.push(chunk.value)
    }
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } catch {
    return reply(400, 'Invalid cache invalidation request')
  } finally { reader.releaseLock() }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return reply(400, 'Invalid cache invalidation request')
  try {
    if (!await invalidateLocalCacheGroups(parsed.data.groups)) return reply(503, 'Cache invalidation unavailable')
  } catch {
    logger.warn('cache_error', { outcome: 'invalidation_error' })
    return reply(503, 'Cache invalidation unavailable')
  }
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
