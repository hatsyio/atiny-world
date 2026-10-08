'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { PublicPoint } from '@/domain/location/public-point'
import { MapErrorBoundary } from './map-error-boundary'

export interface LocationSelectionMapProps {
  point?: PublicPoint
  focusPoint?: PublicPoint
  precise: boolean
  onPointChange: (point: PublicPoint) => void
}

function CanvasPlaceholder() {
  const t = useTranslations('Forms.location')
  return <div className="location-picker__precise-map" aria-label={t('mapSelectHint')} tabIndex={0} />
}

const ClientMap = dynamic(() => import('./location-selection-map-react-leaflet').then(module => module.ReactLeafletSelectionMap), {
  ssr: false, loading: CanvasPlaceholder,
})

export function LocationSelectionMap(props: LocationSelectionMapProps) {
  const t = useTranslations('Forms.location')
  const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  const fallback = <><CanvasPlaceholder /><p className="location-selection-map__unavailable">{t('mapUnavailable')}</p></>
  return <div className="location-selection-map">
    {apiKey ? <MapErrorBoundary fallback={fallback}><ClientMap {...props} apiKey={apiKey} /></MapErrorBoundary> : fallback}
  </div>
}
