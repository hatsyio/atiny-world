'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'

import { MessageClusterList } from './message-cluster-list'

interface Props {
  features: PublicMapFeature[]
  onSelect: (publicId: string) => void
  lang?: 'en' | 'es'
  onViewportChange?: (bounds: MapBounds) => void
  groupRequestUrl?: string
  selectedPublicId?: string
}

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function cartoTileUrl(apiKey: string): string {
  return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(apiKey)}`
}

export function LeafletMap({ features, onSelect, lang = 'en', onViewportChange, groupRequestUrl, selectedPublicId }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<import('leaflet').Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isClusterListOpen, setIsClusterListOpen] = useState(false)
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

  useEffect(() => {
    const apiKey = cartoApiKey
    if (!element.current || !apiKey) return

    let disposed = false

    async function initialize(key: string) {
      try {
        type LeafletModule = typeof import('leaflet')
        const leafletModule = await import('leaflet')
        await import('leaflet.markercluster')

        if (disposed || !element.current) return

        const leaflet = (leafletModule as { default?: LeafletModule }).default ?? leafletModule
        const instance = leaflet.map(element.current, {
          attributionControl: true,
          zoomControl: true,
        }).setView([20, 0], 2)

        leaflet.tileLayer(cartoTileUrl(key), {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(instance)

        const markers = leaflet.markerClusterGroup()
        for (const feature of features) {
          const marker = leaflet.marker([
            feature.point.latitude,
            feature.point.longitude,
          ])
          marker.bindPopup(feature.author.displayName)
          marker.on('click', () => onSelect(feature.publicId))
          markers.addLayer(marker)
          if (feature.publicId === selectedPublicId) {
            instance.setView([feature.point.latitude, feature.point.longitude], 8)
            marker.openPopup()
          }
        }
        instance.addLayer(markers)
        const reportViewport = () => {
          const bounds = instance.getBounds()
          onViewportChange?.({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          })
        }
        instance.on('moveend', reportViewport)
        reportViewport()
        map.current = instance
      } catch {
        if (!disposed) setError('No se pudo cargar el mapa. Inténtalo de nuevo.')
      }
    }

    void initialize(apiKey)

    return () => {
      disposed = true
      map.current?.remove()
      map.current = null
    }
  }, [cartoApiKey, features, onSelect, onViewportChange, selectedPublicId])

  if (!cartoApiKey) {
    return (
      <section className="map map--preview" aria-label="Mapa de mensajes">
        <div className="map__canvas" role="img" aria-label="Mapa del mundo" />
        <p role="status">{lang === 'es' ? 'El mapa interactivo estará disponible próximamente.' : 'The interactive map is coming soon.'}</p>
      </section>
    )
  }

  return (
    <section aria-label="Mapa de mensajes" className={isFullscreen ? 'map map--fullscreen' : 'map'}>
      {error ? <p role="status">{error}</p> : null}
      {features.length > 1 ? (
        <button
          type="button"
          aria-expanded={isClusterListOpen}
          aria-controls="map-cluster-list"
          onClick={() => setIsClusterListOpen((current) => !current)}
        >
          Ver mensajes del grupo ({features.length})
        </button>
      ) : null}
      <button
        type="button"
        aria-pressed={isFullscreen}
        aria-label="Pantalla completa"
        onClick={() => setIsFullscreen((current) => !current)}
      >
        Pantalla completa
      </button>
      <div ref={element} className="map__canvas" />
      {isClusterListOpen ? (
        <div id="map-cluster-list" aria-label="Mensajes del grupo">
          <MessageClusterList
            items={features}
            onSelect={(publicId) => {
              onSelect(publicId)
              setIsClusterListOpen(false)
            }}
            requestUrl={groupRequestUrl}
          />
        </div>
      ) : null}
    </section>
  )
}
