import 'server-only'

import type { PublicPoint } from '../../domain/location/public-point'
import { getGeoapifyApiKey } from '../env'

const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete'
const PROVIDER_TIMEOUT_MS = 5_000

export type GeoapifyLocationQuery = {
  query: string
  language: 'en' | 'es' | 'ko'
  limit: number
}

export type GeoapifyLocationSuggestion = {
  locality: string
  country: string
  countryCode: string
  point: PublicPoint
  attribution: 'Geoapify'
}

export class GeoapifyProviderError extends Error {
  constructor(readonly outcome: 'rate_limited' | 'unavailable') {
    super(outcome)
    this.name = 'GeoapifyProviderError'
  }
}

type GeoapifyResult = {
  city?: unknown
  town?: unknown
  village?: unknown
  municipality?: unknown
  county?: unknown
  country?: unknown
  country_code?: unknown
  lat?: unknown
  lon?: unknown
}

type GeoapifyResponse = { results?: unknown }

type GeoapifyDependencies = {
  apiKey?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normalizeResult(result: GeoapifyResult): GeoapifyLocationSuggestion | null {
  const country = readString(result.country)
  const countryCode = readString(result.country_code)?.toLowerCase()
  const locality = [result.city, result.town, result.village, result.municipality, result.county]
    .map(readString)
    .find((value): value is string => value !== null)

  if (!country || !countryCode || !/^[a-z]{2}$/.test(countryCode) || !locality
    || typeof result.lat !== 'number' || !Number.isFinite(result.lat)
    || typeof result.lon !== 'number' || !Number.isFinite(result.lon)) {
    return null
  }

  return {
    locality,
    country,
    countryCode,
    point: { latitude: result.lat, longitude: result.lon },
    attribution: 'Geoapify',
  }
}

export async function searchGeoapifyLocations(
  query: GeoapifyLocationQuery,
  dependencies: GeoapifyDependencies = {},
): Promise<GeoapifyLocationSuggestion[]> {
  const parameters = new URLSearchParams({
    text: query.query,
    lang: query.language,
    limit: String(query.limit),
    format: 'json',
    bias: 'countrycode:none',
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? PROVIDER_TIMEOUT_MS)

  try {
    const response = await (dependencies.fetch ?? fetch)(`${GEOAPIFY_AUTOCOMPLETE_URL}?${parameters}`, {
      headers: { 'x-api-key': dependencies.apiKey ?? getGeoapifyApiKey() },
      signal: controller.signal,
    })

    if (response.status === 429) throw new GeoapifyProviderError('rate_limited')
    if (!response.ok) throw new GeoapifyProviderError('unavailable')

    const payload = await response.json() as GeoapifyResponse
    if (!Array.isArray(payload.results)) throw new GeoapifyProviderError('unavailable')

    return payload.results
      .map((result) => normalizeResult(result as GeoapifyResult))
      .filter((result): result is GeoapifyLocationSuggestion => result !== null)
  } catch (error) {
    if (error instanceof GeoapifyProviderError) throw error
    throw new GeoapifyProviderError('unavailable')
  } finally {
    clearTimeout(timeout)
  }
}
