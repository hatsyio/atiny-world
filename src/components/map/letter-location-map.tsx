'use client'

import dynamic from 'next/dynamic'
import { MapErrorBoundary } from './map-error-boundary'
import { useTranslations } from 'next-intl'
import type { PublicPoint } from '@/domain/messages/public-message'

const ClientMap = dynamic(() => import('./letter-location-map-react-leaflet').then(module => module.ReactLeafletLetterMap), {
  ssr: false, loading: () => <div className="map__canvas" />,
})

export function LetterLocationMap({ point, content }: { point: PublicPoint; content: string }) {
  const t = useTranslations('Map.leaflet')
  const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  const fallback = <><div className="map__canvas" /><p role="status">{t('unavailable')}</p></>
  return <section className="map map--static" aria-label={t('label')}>
    {apiKey
      ? <MapErrorBoundary fallback={fallback}><ClientMap point={point} content={content} apiKey={apiKey} /></MapErrorBoundary>
      : fallback}
  </section>
}
