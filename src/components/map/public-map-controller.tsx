'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'

import { MapFilters, type MapFilterValues } from './map-filters'
import { PublicMapLoader } from './public-map-loader'

const WORLD_BOUNDS: MapBounds = {
  west: -180,
  south: -90,
  east: 180,
  north: 90,
}

const EMPTY_FILTERS: MapFilterValues = {
  city: '',
  country: '',
  recipient: '',
  fan: '',
}

function appendFilter(
  params: URLSearchParams,
  name: string,
  value: string | undefined,
) {
  if (value) params.set(name, value)
}

export function buildFeatureRequest(
  bounds: MapBounds,
  filters: MapFilterValues,
): string {
  const params = new URLSearchParams({
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
  })

  appendFilter(params, 'city', filters.city)
  appendFilter(params, 'country', filters.country)
  appendFilter(params, 'recipient', filters.recipient)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.fan)) {
    params.set('fan', filters.fan)
  }

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

export function PublicMapController({
  lang = 'en',
  selectedPublicId,
}: {
  lang?: 'en' | 'es'
  selectedPublicId?: string
}) {
  const router = useRouter()
  const [bounds, setBounds] = useState<MapBounds>(WORLD_BOUNDS)
  const [filters, setFilters] = useState<MapFilterValues>(EMPTY_FILTERS)
  const [features, setFeatures] = useState<PublicMapFeature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
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
  }, [bounds, filters, retry])

  const selectMessage = useCallback((publicId: string) => {
    router.push(`/${lang}/messages/${publicId}`)
  }, [lang, router])

  return (
    <section aria-label="Explorar mensajes">
      <MapFilters value={filters} onChange={setFilters} />
      {error ? (
        <div role="status">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((current) => current + 1)}>
            Reintentar
          </button>
        </div>
      ) : null}
      <PublicMapLoader
        features={features}
        onSelect={selectMessage}
        onViewportChange={setBounds}
        groupRequestUrl={buildMessageRequest(bounds, filters)}
        selectedPublicId={selectedPublicId}
      />
    </section>
  )
}
