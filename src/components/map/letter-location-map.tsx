'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import type { PublicPoint } from '@/domain/messages/public-message'
import { CARTO_ATTRIBUTION, cartoTileUrl, createMessageIcon } from './basemap'

export function LetterLocationMap({ point, content }: { point: PublicPoint; content: string }) {
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
        }).setView([latitude, longitude], 15)
        leaflet.tileLayer(cartoTileUrl(key), {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map)
        const paragraph = document.createElement('p')
        paragraph.className = 'map-message-popup'
        paragraph.textContent = content
        const marker = leaflet.marker([latitude, longitude], {
          icon: createMessageIcon(leaflet),
          title: t('viewMessages', { count: 1 }),
          autoPanOnFocus: false,
        }).addTo(map)
        marker.bindPopup(paragraph, {
          className: 'map-letter-popup',
          autoPan: false,
          minWidth: 240,
          maxWidth: 340,
          maxHeight: 90,
        })
        marker.on('popupopen', () => {
          const closeButton = marker.getPopup()?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
          if (closeButton) {
            closeButton.setAttribute('aria-label', t('closePopup'))
            closeButton.title = t('closePopup')
          }
        })
      } catch {
        if (!disposed) setError(true)
      }
    }

    void initialize(apiKey)
    return () => {
      disposed = true
      map?.remove()
    }
  }, [apiKey, latitude, longitude, content, t])

  return (
    <section className="map map--static" aria-label={t('label')}>
      <div ref={element} className="map__canvas" />
      {!apiKey || error ? <p role="status">{t('unavailable')}</p> : null}
    </section>
  )
}
