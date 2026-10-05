'use client'

import type { Locale } from '@/i18n/locale'

import { useLocale, useTranslations } from 'next-intl'

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

import { useEffect, useRef, useState } from 'react'

import type { MapBounds, PublicMapFeature, PublicMessageDetail } from '@/domain/messages/public-message'

import type { MapView } from '@/components/navigation/letter-origin'

import { MapFilters, type MapFilterValues } from './map-filters'
import { MessageClusterList } from './message-cluster-list'

interface Props {
  initialView?: MapView
  onViewChange?: (view: MapView) => void
  features: PublicMapFeature[]
  onSelect: (publicId: string) => void
  lang?: Locale
  onViewportChange?: (bounds: MapBounds) => void
  filters?: MapFilterValues
  onFiltersChange?: (values: MapFilterValues) => void
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

function updateFullscreenControl(button: HTMLButtonElement, isFullscreen: boolean, enter: string, exit: string): void {
  const action = isFullscreen ? exit : enter
  button.setAttribute('aria-label', action)
  button.setAttribute('aria-pressed', String(isFullscreen))
  button.title = action
}

function createFullscreenControl(onToggle: () => void, enter: string, exit: string): HTMLButtonElement {
  const control = document.createElement('button')
  control.type = 'button'
  control.className = 'leaflet-control-zoom-fullscreen'
  control.textContent = '⛶'
  updateFullscreenControl(control, false, enter, exit)
  control.addEventListener('click', onToggle)
  return control
}

type FullscreenControl = import('leaflet').Control & {
  onAdd: () => HTMLElement
}

export function LeafletMap({ initialView, onViewChange, features, onSelect, onViewportChange, filters, onFiltersChange, groupRequestUrl, selectedPublicId }: Props) {
  const lang = useLocale()
  const t = useTranslations('Map.leaflet')
  const translations = useRef(t)
  useEffect(() => { translations.current = t }, [t])
  const popupStates = useRef(new Map<string, 'loadingMessage' | 'messageUnavailable' | 'content'>())
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<import('leaflet').Map | null>(null)
  const cluster = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  const markerLayers = useRef(new Map<string, import('leaflet').Marker>())
  const loadMessages = useRef(new Map<string, () => void>())
  const messageRequests = useRef(new Map<string, AbortController>())
  const centeredPublicId = useRef<string | null>(null)
  const initialViewRef = useRef(initialView)
  const onViewChangeRef = useRef(onViewChange)
  const onViewportChangeRef = useRef(onViewportChange)
  const fullscreenButton = useRef<HTMLButtonElement | null>(null)
  const [instance, setInstance] = useState<import('leaflet').Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isClusterListOpen, setIsClusterListOpen] = useState(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange
    onViewChangeRef.current = onViewChange
  }, [onViewportChange, onViewChange])

  useEffect(() => {
    const apiKey = cartoApiKey
    if (!element.current || !apiKey) return

    let disposed = false
    let removeFullscreenButtonListener: (() => void) | undefined

    async function initialize(key: string) {
      try {
        type LeafletModule = typeof import('leaflet')
        const leafletModule = await import('leaflet')
        await import('leaflet.markercluster')

        if (disposed || !element.current) return

        const leaflet = (leafletModule as { default?: LeafletModule }).default ?? leafletModule
        configureMarkerIcons(leaflet)
        const savedView = initialViewRef.current ?? { latitude: 20, longitude: 0, zoom: 2 }
        const instance = leaflet.map(element.current, {
          attributionControl: true,
          zoomControl: true,
          // Keep the center inside the tile projection while allowing horizontal world wrapping.
          maxBounds: [[-85.05112878, -Infinity], [85.05112878, Infinity]],
          maxBoundsViscosity: 1,
        }).setView([savedView.latitude, savedView.longitude], savedView.zoom)

        leaflet.tileLayer(cartoTileUrl(key), {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(instance)

        const reportViewport = () => {
          const center = instance.getCenter()
          onViewChangeRef.current?.({ latitude: center.lat, longitude: center.lng, zoom: instance.getZoom() })
          const bounds = instance.getBounds()
          onViewportChangeRef.current?.({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          })
        }
        instance.on('moveend', reportViewport)
        instance.on('popupopen', () => {
          const closeButtons = element.current?.querySelectorAll<HTMLAnchorElement>('.leaflet-popup-close-button')
          closeButtons?.forEach((button) => {
            button.setAttribute('aria-label', translations.current('closePopup'))
            button.title = translations.current('closePopup')
          })
        })
        reportViewport()
        const toggleFullscreen = () => setIsFullscreen((current) => !current)
        const fullscreenControl = new leaflet.Control({ position: 'topleft' }) as FullscreenControl
        fullscreenControl.onAdd = () => {
          const container = document.createElement('div')
          container.className = 'leaflet-bar leaflet-control-fullscreen'
          const control = createFullscreenControl(toggleFullscreen, translations.current('enterFullscreen'), translations.current('exitFullscreen'))
          container.append(control)
          fullscreenButton.current = control
          removeFullscreenButtonListener = () => control.removeEventListener('click', toggleFullscreen)
          return container
        }
        instance.addControl(fullscreenControl)
        map.current = instance
        setInstance(instance)
      } catch {
        if (!disposed) setError('unavailable')
      }
    }

    void initialize(apiKey)

    return () => {
      disposed = true
      removeFullscreenButtonListener?.()
      fullscreenButton.current = null
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
      const markers = cluster.current ?? leaflet.markerClusterGroup({
        iconCreateFunction: (group) => {
          const count = group.getChildCount()
          const size = count < 10 ? 36 : count < 100 ? 40 : 44
          return leaflet.divIcon({
            html: `<span>${count}</span>`,
            className: 'map-message-cluster',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        },
      })
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

      const messageIcon = leaflet.divIcon({
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
        className: 'map-message-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      })

      for (const feature of features) {
        let marker = markerLayers.current.get(feature.publicId)
        if (!marker) {
          marker = leaflet.marker([feature.point.latitude, feature.point.longitude], {
            icon: messageIcon,
            title: translations.current('viewMessages', { count: 1 }),
          })
          const currentMarker = marker
          const publicId = feature.publicId

          popupStates.current.set(publicId, 'loadingMessage')
          marker.bindPopup(popupContent(translations.current('loadingMessage')), {
            autoClose: false,
            closeOnClick: false,
            maxWidth: 320,
            maxHeight: 240,
          })

          const loadMessage = async () => {
            messageRequests.current.get(publicId)?.abort()
            const request = new AbortController()
            messageRequests.current.set(publicId, request)
            popupStates.current.set(publicId, 'loadingMessage')
            currentMarker.setPopupContent(popupContent(translations.current('loadingMessage')))
            try {
              const response = await fetch(`/api/messages/${publicId}`, {
                cache: 'no-store',
                signal: request.signal,
              })
              if (!response.ok) throw new Error('message unavailable')
              const message = await response.json() as PublicMessageDetail
              if (!request.signal.aborted && markerLayers.current.get(publicId) === currentMarker) {
                popupStates.current.set(publicId, 'content')
                currentMarker.setPopupContent(popupContent(message.content))
              }
            } catch {
              if (!request.signal.aborted && markerLayers.current.get(publicId) === currentMarker) {
                popupStates.current.set(publicId, 'messageUnavailable')
                currentMarker.setPopupContent(popupContent(translations.current('messageUnavailable')))
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
  }, [instance, features, selectedPublicId])

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

  useEffect(() => {
    const button = fullscreenButton.current
    if (button) updateFullscreenControl(button, isFullscreen, t('enterFullscreen'), t('exitFullscreen'))
  }, [isFullscreen, t, instance])

  useEffect(() => {
    for (const [selector, key] of [['.leaflet-control-zoom-in', 'zoomIn'], ['.leaflet-control-zoom-out', 'zoomOut'], ['.leaflet-popup-close-button', 'closePopup']] as const) {
      element.current?.querySelectorAll<HTMLAnchorElement>(selector).forEach((button) => {
        button.setAttribute('aria-label', t(key))
        button.title = t(key)
      })
    }
    for (const [publicId, state] of popupStates.current) {
      if (state !== 'content') markerLayers.current.get(publicId)?.setPopupContent(popupContent(t(state)))
    }
  }, [t, instance])

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
      {error ? <p role="status">{t('unavailable')}</p> : null}
      <div ref={element} className="map__canvas" />
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
          {isFiltersOpen ? <div id="map-filters-panel" className="map__filters-panel"><MapFilters value={filters} onChange={onFiltersChange} lang={lang} /></div> : null}
        </div>
      ) : null}
      {features.length > 1 ? (
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
                lang={lang}
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
