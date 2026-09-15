import { z } from 'zod'

import { createProblem, toProblemEnvelope } from '@/domain/contracts'
import {
  GeoapifyProviderError,
  searchGeoapifyLocations,
  type GeoapifyLocationQuery,
  type GeoapifyLocationSuggestion,
} from '@/server/locations/geoapify'
import { getLocationSelectionSecret } from '@/server/env'
import { parseJsonBody } from '@/server/http/validation'
import { signLocationSelection, type LocationSelection } from '@/server/locations/selection-token'

const DEFAULT_LIMIT = 5
const PROVIDER_RETRY_AFTER_SECONDS = 60
const GEOAPIFY_ATTRIBUTION = {
  label: 'Geoapify',
  url: 'https://www.geoapify.com/',
} as const

const locationSuggestionRequestSchema = z.object({
  query: z.string().min(2).max(200),
  language: z.enum(['en', 'es', 'ko']),
  limit: z.number().int().min(1).max(8).default(DEFAULT_LIMIT),
}).strict()

type LocationSuggestionRequest = z.infer<typeof locationSuggestionRequestSchema>

type LocationSuggestionsDependencies = {
  search?: (query: GeoapifyLocationQuery) => Promise<GeoapifyLocationSuggestion[]>
  signSelection?: (selection: LocationSelection) => string
}

function providerProblem(status: 429 | 502): Response {
  const rateLimited = status === 429
  const problem = createProblem('LOCATION_PROVIDER_UNAVAILABLE', {
    messageKey: rateLimited ? 'location.providerRateLimited' : 'location.providerUnavailable',
    ...(rateLimited ? { retryAfterSeconds: PROVIDER_RETRY_AFTER_SECONDS } : {}),
  })

  return Response.json(toProblemEnvelope(problem), {
    status,
    ...(rateLimited ? { headers: { 'retry-after': String(PROVIDER_RETRY_AFTER_SECONDS) } } : {}),
  })
}

function publicSuggestion(suggestion: GeoapifyLocationSuggestion, selectionToken: string) {
  return {
    locality: suggestion.locality,
    country: suggestion.country,
    countryCode: suggestion.countryCode,
    point: suggestion.point,
    sourceAttribution: GEOAPIFY_ATTRIBUTION,
    selectionToken,
  }
}

export function createLocationSuggestionsPostHandler(
  dependencies: LocationSuggestionsDependencies = {},
): (request: Request) => Promise<Response> {
  const search = dependencies.search ?? searchGeoapifyLocations
  const signSelection = dependencies.signSelection ?? ((selection) => (
    signLocationSelection(selection, getLocationSelectionSecret())
  ))

  return async function POST(request: Request): Promise<Response> {
    const parsed = await parseJsonBody(request, locationSuggestionRequestSchema)

    if (!parsed.ok) return Response.json(parsed.error, { status: 400 })

    const input: LocationSuggestionRequest = parsed.data
    try {
      const suggestions = await search(input)
      return Response.json({
        suggestions: suggestions.slice(0, input.limit).map((suggestion) => publicSuggestion(
          suggestion,
          signSelection(suggestion),
        )),
        providerAttribution: GEOAPIFY_ATTRIBUTION,
      }, { headers: { 'cache-control': 'no-store' } })
    } catch (error) {
      if (error instanceof GeoapifyProviderError && error.outcome === 'rate_limited') {
        return providerProblem(429)
      }
      return providerProblem(502)
    }
  }
}

export const POST = createLocationSuggestionsPostHandler()
