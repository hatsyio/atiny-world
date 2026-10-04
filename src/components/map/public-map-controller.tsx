'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { rememberLetterOrigin } from '@/components/navigation/letter-link'
import { letterHref, mapOrigin, readMapFilters, readMapView, type MapView } from '@/components/navigation/letter-origin'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'

import type { MapFilterValues } from './map-filters'
import { PublicMapLoader } from './public-map-loader'

const WORLD_BOUNDS: MapBounds = {
  west: -180,
  south: -90,
  east: 180,
  north: 90,
}

const DEFAULT_VIEW: MapView = { latitude: 20, longitude: 0, zoom: 2 }

function appendFilter(
  params: URLSearchParams,
  name: string,
  value: string | undefined,
) {
  if (value) params.set(name, value)
}

function normalizeLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

function requestBounds(bounds: MapBounds): MapBounds {
  if (bounds.east - bounds.west >= 360) {
    return { ...bounds, west: -180, east: 180 }
  }

  return {
    ...bounds,
    west: normalizeLongitude(bounds.west),
    east: normalizeLongitude(bounds.east),
  }
}

export function buildFeatureRequest(
  bounds: MapBounds,
  filters: MapFilterValues,
): string {
  const viewport = requestBounds(bounds)
  const params = new URLSearchParams({
    west: String(viewport.west),
    south: String(viewport.south),
    east: String(viewport.east),
    north: String(viewport.north),
  })

  appendFilter(params, 'city', filters.city)
  appendFilter(params, 'country', filters.country)
  return `/api/map/features?${params.toString()}`
}

export function buildMessageRequest(
  bounds: MapBounds,
  filters: MapFilterValues,
  cursor?: string,
): string {
  const url = buildFeatureRequest(bounds, filters).replace('/features?', '/messages?')
  const params = new URLSearchParams(url.split('?')[1])
  params.set('limit', '20')
  if (cursor) params.set('cursor', cursor)
  return `/api/map/messages?${params.toString()}`
}

export function PublicMapController({ lang = 'en', selectedPublicId }: {
  lang?: 'en' | 'es'
  selectedPublicId?: string
}) {
  const params = useSearchParams()
  const initialView = selectedPublicId ? DEFAULT_VIEW : readMapView(params) ?? DEFAULT_VIEW
  const initialFilters = selectedPublicId ? { city: '', country: '' } : readMapFilters(params)
  // Next can retain a page between visits. A different URL context is a different exploration.
  const contextKey = JSON.stringify([selectedPublicId, initialView, initialFilters])
  return <MapExploration key={contextKey} lang={lang} selectedPublicId={selectedPublicId} initialView={initialView} initialFilters={initialFilters} />
}

function MapExploration({ lang, selectedPublicId, initialView, initialFilters }: {
  lang: 'en' | 'es'
  selectedPublicId?: string
  initialView: MapView
  initialFilters: MapFilterValues
}) {
  const router = useRouter()
  const view = useRef(initialView)
  const [bounds, setBounds] = useState<MapBounds>(WORLD_BOUNDS)
  const [filters, setFilters] = useState<MapFilterValues>(initialFilters)
  const [features, setFeatures] = useState<PublicMapFeature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const hasBasemap = Boolean(process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY)

  useEffect(() => {
    const refreshViewport = () => setRetry((current) => current + 1)
    window.addEventListener('atiny:message-published', refreshViewport)
    return () => window.removeEventListener('atiny:message-published', refreshViewport)
  }, [])

  useEffect(() => {
    if (!hasBasemap) return
    const controller = new AbortController()

    async function loadFeatures() {
      setError(null)
      try {
        const response = await fetch(buildFeatureRequest(bounds, filters), {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('map features unavailable')

        const body = (await response.json()) as { features?: PublicMapFeature[] }
        setFeatures(body.features ?? [])
      } catch {
        if (!controller.signal.aborted) {
          setError('No se pudieron cargar los mensajes del mapa.')
        }
      }
    }

    void loadFeatures()
    return () => controller.abort()
  }, [bounds, filters, retry, hasBasemap])

  const selectMessage = useCallback((publicId: string) => {
    const origin = mapOrigin(lang, view.current, filters)
    rememberLetterOrigin(origin)
    router.push(letterHref(lang, publicId, origin))
  }, [lang, router, filters])

  return (
    <section aria-label="Explorar mensajes">
      <div className="map-feedback" aria-live="polite" aria-atomic="true">
        {error ? (
          <div role="status">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((current) => current + 1)}>
              Reintentar
            </button>
          </div>
        ) : null}
      </div>
      <PublicMapLoader
        initialView={initialView}
        onViewChange={(nextView) => { view.current = nextView }}
        features={features}
        onSelect={selectMessage}
        lang={lang}
        onViewportChange={setBounds}
        filters={filters}
        onFiltersChange={setFilters}
        groupRequestUrl={buildMessageRequest(bounds, filters)}
        selectedPublicId={selectedPublicId}
      />
    </section>
  )
}
