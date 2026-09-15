import { pagePublicMessages } from '@/server/messages/public-repository'
import { verifyCursor } from '@/server/messages/cursor'
import { getDb } from '@/server/db/client'
import { parseMapQuery } from '@/server/http/map-params'
import { toProblemEnvelope, createProblem } from '@/domain/contracts'

export const MAX_MESSAGE_PAGE_SIZE = 50

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const parsed = parseMapQuery(url.searchParams)

  if (!parsed.ok) {
    return Response.json(parsed.error, { status: 400 })
  }

  const { west, south, east, north, recipient, fan, city, country, cursor, limit } = parsed.data

  if (cursor !== undefined && verifyCursor(cursor) === null) {
    return Response.json(
      toProblemEnvelope(
        createProblem('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' }),
      ),
      { status: 400 },
    )
  }

  try {
    const page = await pagePublicMessages(getDb(), {
      bounds: { west, south, east, north },
      recipient: recipient ?? undefined,
      fan: fan ?? undefined,
      city: city ?? undefined,
      country: country ?? undefined,
      cursor,
      limit: Math.min(limit ?? 20, MAX_MESSAGE_PAGE_SIZE),
    })

    return Response.json(page, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch {
    const problem = createProblem('MAP_DATA_UNAVAILABLE', {
      messageKey: 'map.dataUnavailable',
    })
    return Response.json(toProblemEnvelope(problem), { status: 503 })
  }
}
