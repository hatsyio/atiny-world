import { listFeaturesInViewport } from '@/server/messages/public-repository'
import { getDb } from '@/server/db/client'
import { parseMapQuery } from '@/server/http/map-params'
import { toProblemEnvelope } from '@/domain/contracts'
import { createProblem } from '@/domain/contracts'

export const MAX_MAP_FEATURES = 2000

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const parsed = parseMapQuery(url.searchParams)

  if (!parsed.ok) {
    return Response.json(parsed.error, { status: 400 })
  }

  const { west, south, east, north, zoom, recipient, fan, city, country } = parsed.data

  try {
    const features = await listFeaturesInViewport(getDb(), { west, south, east, north }, {
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
  } catch {
    const problem = createProblem('MAP_DATA_UNAVAILABLE', {
      messageKey: 'map.dataUnavailable',
    })
    return Response.json(toProblemEnvelope(problem), { status: 503 })
  }
}
