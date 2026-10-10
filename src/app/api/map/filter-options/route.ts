import { createProblem, toProblemEnvelope } from '@/domain/contracts'
import { getDb } from '@/server/db/client'
import { listPublicLetterLocations } from '@/server/messages/public-repository'
import { createLogger } from '@/server/observability/logger'

const logger = createLogger('api.map.filter-options')

export async function GET(): Promise<Response> {
  try {
    const locations = await listPublicLetterLocations(getDb())
    return Response.json({ locations }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    logger.error('map_filter_options_request_failed', { error_class: error instanceof Error ? error.name : 'unknown' })
    return Response.json(toProblemEnvelope(createProblem('MAP_DATA_UNAVAILABLE', {
      messageKey: 'map.dataUnavailable',
    })), { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
