'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { PublicPoint } from '@/domain/messages/public-message'

const ClientMap = dynamic(() => import('./letter-location-map-react-leaflet').then(module => module.ReactLeafletLetterMap), {
  ssr: false, loading: () => <div className="map__canvas" />,
})

class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function LetterLocationMap({ point, content }: { point: PublicPoint; content: string }) {
  const t = useTranslations('Map.leaflet')
  const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  const fallback = <><div className="map__canvas" /><p role="status">{t('unavailable')}</p></>
  return <section className="map map--static" aria-label={t('label')}>
    {apiKey
      ? <MapBoundary fallback={fallback}><ClientMap point={point} content={content} apiKey={apiKey} /></MapBoundary>
      : fallback}
  </section>
}
