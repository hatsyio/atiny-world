import { searchPublicUsers } from '@/server/messages/public-repository'
import { verifyCursor } from '@/server/messages/cursor'
import { getDb } from '@/server/db/client'
import { parseUserSearchQuery } from '@/server/http/map-params'
import { createProblem, toProblemEnvelope } from '@/domain/contracts'

export const MAX_USER_SEARCH_PAGE_SIZE = 50

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const parsed = parseUserSearchQuery(url.searchParams)

  if (!parsed.ok) {
    return Response.json(parsed.error, { status: 400 })
  }

  const { q, cursor, limit } = parsed.data

  if (cursor !== undefined && verifyCursor(cursor) === null) {
    return Response.json(
      toProblemEnvelope(
        createProblem('VALIDATION_ERROR', { messageKey: 'validation.invalidFields' }),
      ),
      { status: 400 },
    )
  }

  try {
    const page = await searchPublicUsers(getDb(), {
      query: q,
      cursor,
      limit: Math.min(limit ?? 20, MAX_USER_SEARCH_PAGE_SIZE),
    })

    return Response.json(page)
  } catch {
    return Response.json(
      toProblemEnvelope(
        createProblem('INTERNAL_ERROR', { messageKey: 'error.internal' }),
      ),
      { status: 500 },
    )
  }
}