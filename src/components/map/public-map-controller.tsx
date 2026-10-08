'use client'

import { useTranslations } from 'next-intl'

import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { mapFeaturesQuery } from './map-queries'
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

export function PublicMapController({ selectedPublicId: requestedPublicId, selectedMessage }: {
  selectedPublicId?: string
  selectedMessage?: PublicMapFeature
}) {
  const params = useSearchParams()
  const selectedPublicId = selectedMessage?.publicId ?? requestedPublicId
  const initialView = selectedMessage ? { ...selectedMessage.point, zoom: 8 } : selectedPublicId ? DEFAULT_VIEW : readMapView(params) ?? DEFAULT_VIEW
  const initialFilters = selectedPublicId ? { city: '', country: '' } : readMapFilters(params)
  // Next can retain a page between visits. A different URL context is a different exploration.
  const contextKey = JSON.stringify([selectedPublicId, initialView, initialFilters])
  return <MapExploration key={contextKey} selectedPublicId={selectedPublicId} selectedMessage={selectedMessage} initialView={initialView} initialFilters={initialFilters} />
}

function MapExploration({ selectedPublicId, selectedMessage, initialView, initialFilters }: {
  selectedPublicId?: string
  selectedMessage?: PublicMapFeature
  initialView: MapView
  initialFilters: MapFilterValues
}) {
  const t = useTranslations('Map.controller')
  const router = useRouter()
  const view = useRef(initialView)
  const [bounds, setBounds] = useState<MapBounds>(WORLD_BOUNDS)
  const [filters, setFilters] = useState<MapFilterValues>(initialFilters)
  const hasBasemap = Boolean(process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY)
  const query = useQuery({
    ...mapFeaturesQuery(buildFeatureRequest(bounds, filters)),
    enabled: hasBasemap,
    placeholderData: (previousData, previousQuery) => {
      const previousUrl = previousQuery?.queryKey[2]
      if (typeof previousUrl !== 'string') return undefined
      const previousFilters = new URLSearchParams(previousUrl.split('?')[1])
      // A viewport refresh must not remove the marker that owns the open popup.
      // Filter changes still clear the old results immediately.
      if ((previousFilters.get('city') ?? '') === filters.city &&
        (previousFilters.get('country') ?? '') === filters.country) return previousData
      return undefined
    },
  })
  const features = query.isError ? [] : query.data?.features ?? (query.isPending && selectedMessage && !filters.city && !filters.country ? [selectedMessage] : [])

  const selectMessage = useCallback((publicId: string) => {
    const origin = mapOrigin(view.current, filters)
    rememberLetterOrigin(origin)
    router.push(letterHref(publicId, origin))
  }, [router, filters])

  return (
    <section aria-label={t('explore')}>
      <div className="map-feedback" aria-live="polite" aria-atomic="true">
        {query.isError ? (
          <div role="status">
            <p>{t('unavailable')}</p>
            <button type="button" onClick={() => void query.refetch()}>
              {t('retry')}
            </button>
          </div>
        ) : null}
      </div>
      <PublicMapLoader
        initialView={initialView}
        onViewChange={(nextView) => { view.current = nextView }}
        features={features}
        onSelect={selectMessage}
        onViewportChange={setBounds}
        filters={filters}
        onFiltersChange={setFilters}
        groupRequestUrl={buildMessageRequest(bounds, filters)}
        selectedPublicId={selectedPublicId}
      />
    </section>
  )
}
