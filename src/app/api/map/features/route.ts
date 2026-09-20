import type { Sql } from 'postgres'

import { createProblem, toProblemEnvelope } from '@/domain/contracts'
import type { PublicMapFeature } from '@/domain/messages/public-message'
import { getDb } from '@/server/db/client'
import { parseMapQuery } from '@/server/http/map-params'
import { createLogger, type Logger } from '@/server/observability/logger'
import {
  listFeaturesInViewport,
  type MapBounds,
  type MapFeatureOptions,
} from '@/server/messages/public-repository'

export const MAX_MAP_FEATURES = 2000

type MapFeaturesDependencies = {
  list?: (
    sql: Sql,
    bounds: MapBounds,
    options: MapFeatureOptions,
  ) => Promise<PublicMapFeature[]>
  getDatabase?: () => Sql
  logger?: Logger
}

export function createMapFeaturesGetHandler(
  dependencies: MapFeaturesDependencies = {},
): (request: Request) => Promise<Response> {
  const list = dependencies.list ?? listFeaturesInViewport
  const getDatabase = dependencies.getDatabase ?? getDb
  const logger = dependencies.logger ?? createLogger('api.map.features')

  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const parsed = parseMapQuery(url.searchParams)

    if (!parsed.ok) {
      return Response.json(parsed.error, { status: 400 })
    }

    const { west, south, east, north, zoom, recipient, fan, city, country } = parsed.data

    try {
      const features = await list(getDatabase(), { west, south, east, north }, {
        limit: MAX_MAP_FEATURES,
        recipient: recipient ?? undefined,
        fan: fan ?? undefined,
        city: city ?? undefined,
        country: country ?? undefined,
      })

      return Response.json(
        { features, truncated: zoom !== undefined && features.length >= MAX_MAP_FEATURES },
        {
          headers: { 'cache-control': 'no-store' },
        },
      )
    } catch (error) {
      logger.error('map features unavailable', {
        errorClass: error instanceof Error ? error.name : 'unknown',
      })
      const problem = createProblem('MAP_DATA_UNAVAILABLE', {
        messageKey: 'map.dataUnavailable',
      })
      return Response.json(toProblemEnvelope(problem), { status: 503 })
    }
  }
}

export const GET = createMapFeaturesGetHandler()
