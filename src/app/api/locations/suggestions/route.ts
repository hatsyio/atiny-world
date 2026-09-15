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
const LOCAL_RATE_LIMIT = 30
const LOCAL_RATE_LIMIT_WINDOW_MS = 60_000
const MAX_RATE_LIMIT_CLIENTS = 10_000
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
  clientKey?: (request: Request) => string
  rateLimiter?: RateLimiter
}

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }
type RateLimiter = (clientKey: string) => RateLimitResult

type RateLimitEntry = { windowStart: number; requests: number }

function createFixedWindowRateLimiter(
  limit = LOCAL_RATE_LIMIT,
  windowMs = LOCAL_RATE_LIMIT_WINDOW_MS,
  maxClients = MAX_RATE_LIMIT_CLIENTS,
  now: () => number = Date.now,
): RateLimiter {
  const entries = new Map<string, RateLimitEntry>()

  return (clientKey) => {
    const currentTime = now()
    const windowStart = Math.floor(currentTime / windowMs) * windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - currentTime) / 1_000))
    const previous = entries.get(clientKey)

    if (previous?.windowStart === windowStart) {
      previous.requests += 1
      entries.delete(clientKey)
      entries.set(clientKey, previous)
      return { allowed: previous.requests <= limit, retryAfterSeconds }
    }

    if (!previous && entries.size >= maxClients) {
      const oldestClient = entries.keys().next().value
      if (oldestClient !== undefined) entries.delete(oldestClient)
    }

    entries.set(clientKey, { windowStart, requests: 1 })
    return { allowed: true, retryAfterSeconds }
  }
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const client = forwarded || request.headers.get('x-real-ip') || 'anonymous'
  return client.slice(0, 200)
}

function rateLimitedProblem(messageKey: string, retryAfterSeconds: number): Response {
  const problem = createProblem('LOCATION_PROVIDER_UNAVAILABLE', {
    messageKey,
    retryAfterSeconds,
  })

  return Response.json(toProblemEnvelope(problem), {
    status: 429,
    headers: { 'retry-after': String(retryAfterSeconds) },
  })
}

function providerUnavailableProblem(): Response {
  return Response.json(toProblemEnvelope(createProblem('LOCATION_PROVIDER_UNAVAILABLE', {
    messageKey: 'location.providerUnavailable',
  })), { status: 502 })
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
  const clientKey = dependencies.clientKey ?? getClientKey
  const rateLimiter = dependencies.rateLimiter ?? createFixedWindowRateLimiter()

  return async function POST(request: Request): Promise<Response> {
    const parsed = await parseJsonBody(request, locationSuggestionRequestSchema)

    if (!parsed.ok) return Response.json(parsed.error, { status: 400 })

    const rateLimit = rateLimiter(clientKey(request))
    if (!rateLimit.allowed) return rateLimitedProblem('location.rateLimited', rateLimit.retryAfterSeconds)

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
        return rateLimitedProblem('location.providerRateLimited', PROVIDER_RETRY_AFTER_SECONDS)
      }
      return providerUnavailableProblem()
    }
  }
}

export const POST = createLocationSuggestionsPostHandler()
