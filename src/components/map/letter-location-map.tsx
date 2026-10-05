'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import type { PublicPoint } from '@/domain/messages/public-message'
import { CARTO_ATTRIBUTION, cartoTileUrl, createMessageIcon } from './basemap'

export function LetterLocationMap({ point }: { point: PublicPoint }) {
  const t = useTranslations('Map.leaflet')
  const element = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  const { latitude, longitude } = point

  useEffect(() => {
    if (!element.current || !apiKey) return
    let disposed = false
    let map: import('leaflet').Map | undefined

    async function initialize(key: string) {
      try {
        const leafletModule = await import('leaflet')
        if (disposed || !element.current) return
        const leaflet = leafletModule.default ?? leafletModule
        map = leaflet.map(element.current, {
          attributionControl: true,
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
          boxZoom: false,
          keyboard: false,
        }).setView([latitude, longitude], 13)
        leaflet.tileLayer(cartoTileUrl(key), {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map)
        leaflet.marker([latitude, longitude], {
          icon: createMessageIcon(leaflet),
          interactive: false,
          keyboard: false,
        }).addTo(map)
      } catch {
        if (!disposed) setError(true)
      }
    }

    void initialize(apiKey)
    return () => {
      disposed = true
      map?.remove()
    }
  }, [apiKey, latitude, longitude])

  return (
    <section className="map map--static" aria-label={t('label')}>
      <div ref={element} className="map__canvas" />
      {!apiKey || error ? <p role="status">{t('unavailable')}</p> : null}
    </section>
  )
}
