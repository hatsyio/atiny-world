'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'

import type { MapBounds, PublicMapFeature, PublicMessageDetail } from '@/domain/messages/public-message'

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

export function configureMarkerIcons(leaflet: typeof import('leaflet')): void {
  leaflet.Icon.Default.imagePath = '/images/leaflet/'
}

function popupContent(content: string): HTMLElement {
  const paragraph = document.createElement('p')
  paragraph.className = 'map-message-popup'
  paragraph.textContent = content
  return paragraph
}

export function LeafletMap({ features, onSelect, lang = 'en', onViewportChange, groupRequestUrl, selectedPublicId }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<import('leaflet').Map | null>(null)
  const cluster = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  const markerLayers = useRef(new Map<string, import('leaflet').Marker>())
  const loadMessages = useRef(new Map<string, () => void>())
  const messageRequests = useRef(new Map<string, AbortController>())
  const centeredPublicId = useRef<string | null>(null)
  const onViewportChangeRef = useRef(onViewportChange)
  const [instance, setInstance] = useState<import('leaflet').Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isClusterListOpen, setIsClusterListOpen] = useState(false)
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange
  }, [onViewportChange])

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
        configureMarkerIcons(leaflet)
        const instance = leaflet.map(element.current, {
          attributionControl: true,
          zoomControl: true,
        }).setView([20, 0], 2)

        leaflet.tileLayer(cartoTileUrl(key), {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(instance)

        const reportViewport = () => {
          const bounds = instance.getBounds()
          onViewportChangeRef.current?.({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          })
        }
        instance.on('moveend', reportViewport)
        reportViewport()
        map.current = instance
        setInstance(instance)
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
  }, [cartoApiKey])

  useEffect(() => {
    if (!instance) return
    const currentInstance = instance
    let active = true

    async function updateMarkers() {
      const leafletModule = await import('leaflet')
      if (!active) return
      const leaflet = (leafletModule as { default?: typeof import('leaflet') }).default ?? leafletModule
      const markers = cluster.current ?? leaflet.markerClusterGroup()
      if (!cluster.current) {
        cluster.current = markers
        currentInstance.addLayer(markers)
      }

      const nextIds = new Set(features.map((feature) => feature.publicId))
      for (const [publicId, marker] of markerLayers.current) {
        if (nextIds.has(publicId)) continue
        messageRequests.current.get(publicId)?.abort()
        messageRequests.current.delete(publicId)
        loadMessages.current.delete(publicId)
        markers.removeLayer(marker)
        markerLayers.current.delete(publicId)
      }

      for (const feature of features) {
        let marker = markerLayers.current.get(feature.publicId)
        if (!marker) {
          marker = leaflet.marker([feature.point.latitude, feature.point.longitude])
          const currentMarker = marker
          const publicId = feature.publicId
          const loading = lang === 'es' ? 'Cargando mensaje…' : 'Loading message…'
          const unavailable = lang === 'es' ? 'No se pudo cargar el mensaje.' : 'The message could not be loaded.'
          marker.bindPopup(popupContent(loading), {
            autoClose: false,
            closeOnClick: false,
            maxWidth: 320,
            maxHeight: 240,
          })

          const loadMessage = async () => {
            messageRequests.current.get(publicId)?.abort()
            const request = new AbortController()
            messageRequests.current.set(publicId, request)
            currentMarker.setPopupContent(popupContent(loading))
            try {
              const response = await fetch(`/api/messages/${publicId}`, {
                cache: 'no-store',
                signal: request.signal,
              })
              if (!response.ok) throw new Error('message unavailable')
              const message = await response.json() as PublicMessageDetail
              if (!request.signal.aborted && markerLayers.current.get(publicId) === currentMarker) {
                currentMarker.setPopupContent(popupContent(message.content))
              }
            } catch {
              if (!request.signal.aborted && markerLayers.current.get(publicId) === currentMarker) {
                currentMarker.setPopupContent(popupContent(unavailable))
              }
            } finally {
              if (messageRequests.current.get(publicId) === request) messageRequests.current.delete(publicId)
            }
          }

          const openMessage = () => { void loadMessage() }
          marker.on('click', openMessage)
          loadMessages.current.set(publicId, openMessage)
          markers.addLayer(marker)
          markerLayers.current.set(publicId, marker)
        }
        if (feature.publicId === selectedPublicId && centeredPublicId.current !== selectedPublicId) {
          centeredPublicId.current = selectedPublicId
          currentInstance.setView([feature.point.latitude, feature.point.longitude], 8)
          marker.openPopup()
          loadMessages.current.get(selectedPublicId)?.()
        }
      }
    }

    void updateMarkers()
    return () => { active = false }
  }, [instance, features, selectedPublicId, lang])

  useEffect(() => {
    if (!instance) return
    const requests = messageRequests.current
    const layers = markerLayers.current
    const loaders = loadMessages.current
    return () => {
      for (const request of requests.values()) request.abort()
      requests.clear()
      layers.clear()
      loaders.clear()
      cluster.current = null
      centeredPublicId.current = null
    }
  }, [instance])

  useEffect(() => {
    if (!instance) return
    const timer = window.setTimeout(() => instance.invalidateSize(), 0)
    return () => window.clearTimeout(timer)
  }, [instance, isFullscreen])

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
