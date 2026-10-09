'use client'

import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'
import type { MapView } from '@/components/navigation/letter-origin'
import { MapErrorBoundary } from './map-error-boundary'
import { MapFilters, type MapFilterValues } from './map-filters'
import { MessageClusterList } from './message-cluster-list'

export interface LeafletMapProps {
  initialView?: MapView
  onViewChange?: (view: MapView) => void
  features: PublicMapFeature[]
  onSelect: (publicId: string) => void
  onViewportChange?: (bounds: MapBounds) => void
  filters?: MapFilterValues
  onFiltersChange?: (values: MapFilterValues) => void
  groupRequestUrl?: string
  selectionVersion?: number
  focusSelection?: boolean
  onPreview?: (publicId: string) => void
  hideGroupList?: boolean
  selectedPublicId?: string
}

export { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons } from './basemap'

const ClientMap = dynamic(() => import('./public-map-react-leaflet').then(module => module.ReactLeafletPublicMap), {
  ssr: false, loading: () => <div className="map__canvas" />,
})

export function LeafletMap({ initialView, onViewChange, features, onSelect, onViewportChange, filters, onFiltersChange, groupRequestUrl, selectedPublicId, focusSelection, onPreview, hideGroupList, selectionVersion }: LeafletMapProps) {
  const t = useTranslations('Map.leaflet')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isClusterListOpen, setIsClusterListOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

  useEffect(() => {
    if (!isFullscreen) return
    const exitFullscreen = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', exitFullscreen)
    return () => window.removeEventListener('keydown', exitFullscreen)
  }, [isFullscreen])

  if (!cartoApiKey) {
    return (
      <section className="map map--preview" aria-label={t('label')}>
        <div className="map__canvas" role="img" aria-label={t('world')} />
        <p role="status">{t('preview')}</p>
      </section>
    )
  }

  return (
    <section aria-label={t('label')} className={isFullscreen ? 'map map--fullscreen' : 'map'}>
      <MapErrorBoundary fallback={<><div className="map__canvas" /><p role="status">{t('unavailable')}</p></>}>
        <ClientMap initialView={initialView} onViewChange={onViewChange} features={features} onSelect={onSelect}
          onViewportChange={onViewportChange} selectedPublicId={selectedPublicId} focusSelection={focusSelection} selectionVersion={selectionVersion} onPreview={onPreview} apiKey={cartoApiKey}
          isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(current => !current)} />
      </MapErrorBoundary>
      {filters && onFiltersChange ? (
        <div className="map__filters">
          <button
            className="map__filters-toggle"
            type="button"
            aria-expanded={isFiltersOpen}
            aria-controls="map-filters-panel"
            onClick={() => {
              setIsFiltersOpen((current) => !current)
              setIsClusterListOpen(false)
            }}
          >
            {t('filters')}{filters.city || filters.country ? ` (${Number(Boolean(filters.city)) + Number(Boolean(filters.country))})` : ''}
          </button>
          {isFiltersOpen ? <div id="map-filters-panel" className="map__filters-panel"><MapFilters value={filters} onChange={onFiltersChange} /></div> : null}
        </div>
      ) : null}
      {!hideGroupList && features.length > 1 ? (
        <div className="map__overlay">
          <button
            className="map__group-toggle"
            type="button"
            aria-expanded={isClusterListOpen}
            aria-controls="map-cluster-list"
            onClick={() => {
              setIsClusterListOpen((current) => !current)
              setIsFiltersOpen(false)
            }}
          >
            {t('viewMessages', {count: features.length})}
          </button>
          {isClusterListOpen ? (
            <div id="map-cluster-list" className="map__message-panel" aria-label={t('messages')}>
              {groupRequestUrl ? <MessageClusterList
                key={groupRequestUrl}
                requestUrl={groupRequestUrl}
                onSelect={(publicId) => {
                  onSelect(publicId)
                  setIsClusterListOpen(false)
                }}
              /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
