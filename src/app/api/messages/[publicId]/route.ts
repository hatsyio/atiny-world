import { getVisibleMessage } from '@/server/messages/public-repository'
import { getDb } from '@/server/db/client'
import { createProblem, parsePublicId, toProblemEnvelope } from '@/domain/contracts'

function extractPublicId(request: Request): { ok: true; value: string } | { ok: false } {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const candidate = segments[segments.length - 1] ?? ''
  return parsePublicId(candidate)
}

export async function GET(request: Request): Promise<Response> {
  const publicId = extractPublicId(request)

  if (!publicId.ok) {
    return Response.json(
      toProblemEnvelope(
        createProblem('NOT_FOUND', { messageKey: 'message.notFound' }),
      ),
      { status: 404 },
    )
  }

  try {
    const message = await getVisibleMessage(getDb(), publicId.value)

    if (message === null) {
      return Response.json(
        toProblemEnvelope(
          createProblem('NOT_FOUND', { messageKey: 'message.notFound' }),
        ),
        { status: 404 },
      )
    }

    return Response.json(message, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch {
    return Response.json(
      toProblemEnvelope(
        createProblem('MAP_DATA_UNAVAILABLE', { messageKey: 'map.dataUnavailable' }),
      ),
      { status: 503 },
    )
  }
}