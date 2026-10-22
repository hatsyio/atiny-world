'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { useLeafletContext } from '@react-leaflet/core'
import leaflet from 'leaflet'
import { AttributionControl, MapContainer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet'
import type { PublicMapFeature } from '@/domain/messages/public-message'
import type { LeafletMapProps } from './leaflet-map'
import { configureMarkerIcons, createMessageIcon } from './basemap'
import { VectorBasemap, VECTOR_ATTRIBUTION } from './vector-basemap'
import { publicMessageQuery } from './map-queries'
import { MarkerCluster } from './marker-cluster'
import { navigateToMessage, navigateToLocation, prefersReducedMotion } from './map-navigation'

type Props = Pick<LeafletMapProps, 'features' | 'onSelect' | 'initialView' | 'onViewChange' | 'onViewportChange' | 'selectedPublicId' | 'focusSelection' | 'onPreview' | 'selectionVersion' | 'geographicTarget' | 'navigationVersion'> & {
  apiKey: string
  isFullscreen: boolean
  onToggleFullscreen: () => void
  overlay?: ReactNode
}

function MessageContent({ publicId, onSelect, popup, focusOnLoad }: { publicId: string; onSelect: Props['onSelect']; popup: RefObject<leaflet.Popup | null>; focusOnLoad: boolean }) {
  const t = useTranslations('Map.leaflet')
  const result = useQuery(publicMessageQuery(publicId))
  const readButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // A mobile panel selection hides its original button; continue in the preview.
    if (focusOnLoad && result.isSuccess) readButton.current?.focus({ preventScroll: true })
  }, [focusOnLoad, result.isSuccess, publicId])
  useLayoutEffect(() => {
    // The query updates inside the portal, so React Leaflet cannot detect its new size.
    // Recalculate before paint so auto-pan uses the loaded letter's height.
    if (popup.current) { popup.current.update(); return }
    // An already cached letter can mount inside the portal before Popup sets
    // its ref. Recalculate once after that commit, including the loaded size.
    const timer = window.setTimeout(() => popup.current?.update(), 0)
    return () => window.clearTimeout(timer)
  }, [popup, result.data?.content, result.isError, t])
  if (result.isError || !result.data) return <p className="map-message-popup">{t(result.isError ? 'messageUnavailable' : 'loadingMessage')}</p>
  return <div className="map-message-letter">
    <p className="map-message-popup">{result.data.content}</p>
    <p className="map-message-meta">{result.data.author?.displayName}</p>
    <p className="map-message-meta">{[result.data.locality, result.data.country].filter(Boolean).join(', ')}</p>
    <button ref={readButton} type="button" className="map-message-read" onClick={() => onSelect(publicId)}>{t('readFullMessage')}</button>
  </div>
}

function PublicMarker({ feature, onSelect, selected, centered, focusSelection = true, onPreview, selectionVersion = 0 }: { feature: PublicMapFeature; onSelect: Props['onSelect']; selected: boolean; centered: RefObject<string | null>; focusSelection?: boolean; onPreview?: Props['onPreview']; selectionVersion?: number }) {
  const t = useTranslations('Map.leaflet')
  const { map } = useLeafletContext()
  const marker = useRef<leaflet.Marker>(null)
  const popup = useRef<leaflet.Popup>(null)
  const [open, setOpen] = useState(false)
  const [mapSize, setMapSize] = useState(() => map.getSize())
  useEffect(() => {
    const resize = () => setMapSize(map.getSize())
    map.on('resize', resize)
    return () => { map.off('resize', resize) }
  }, [map])
  // Reserve the content margins, close control, tip and auto-pan padding.
  const maxWidth = Math.max(80, Math.min(340, mapSize.x - 110))
  const maxHeight = Math.max(32, selected && focusSelection ? mapSize.y / 2 - 128 : mapSize.y - 160)
  useLayoutEffect(() => {
    const current = popup.current
    if (!current) return
    Object.assign(current.options, { minWidth: Math.min(180, maxWidth), maxWidth, maxHeight })
    current.update()
  }, [maxWidth, maxHeight])
  const icon = useMemo(() => {
    const icon = createMessageIcon(leaflet)
    if (selected) icon.options.className += ' map-message-marker--selected'
    return icon
  }, [selected])
  const position = useMemo<[number, number]>(() => [feature.point.latitude, feature.point.longitude], [feature.point.latitude, feature.point.longitude])
  const title = t('viewMessages', { count: 1 })
  const closeLabel = t('closePopup')
  const labelCloseButton = () => {
    const button = popup.current?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
    if (button) { button.title = closeLabel; button.setAttribute('aria-label', closeLabel) }
  }
  useEffect(() => {
    const element = marker.current?.getElement()
    if (element) { element.title = title; element.setAttribute('aria-pressed', String(selected)) }
    if (marker.current) marker.current.options.title = title
    const button = popup.current?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
    if (button) { button.title = closeLabel; button.setAttribute('aria-label', closeLabel) }
  }, [title, closeLabel, selected])

  useEffect(() => {
    if (!selected || centered.current === `${feature.publicId}:${selectionVersion}`) return
    // Located letters live outside the cluster, so later marker batches cannot
    // absorb their marker or close the reading popup.
    let cancel: (() => void) | undefined
    const timer = window.setTimeout(() => {
      const current = marker.current
      if (!current) return
      centered.current = `${feature.publicId}:${selectionVersion}`
      if (focusSelection) cancel = navigateToMessage(map, position, () => current.openPopup(), prefersReducedMotion())
      else current.openPopup()
    }, 0)
    return () => { window.clearTimeout(timer); if (map.getContainer().isConnected) cancel?.() }
  }, [selected, feature.publicId, position, map, centered, focusSelection, selectionVersion])

  // React Leaflet updates popup layout when the children element changes.
  // Keep it stable during viewport refreshes so it cannot restart auto-pan.
  const content = useMemo(() => open ? <MessageContent publicId={feature.publicId} onSelect={onSelect} popup={popup} focusOnLoad={selected && focusSelection} /> : null,
    [open, feature.publicId, onSelect, selected, focusSelection])
  return <Marker ref={marker} position={position} icon={icon} title={title}
    eventHandlers={{ popupopen: () => { setOpen(true); if (!selected) onPreview?.(feature.publicId) }, popupclose: () => setOpen(false) }}>
    <Popup ref={popup} autoPan={!selected || !focusSelection} className="map-letter-popup" autoClose closeOnClick minWidth={Math.min(180, maxWidth)} maxWidth={maxWidth} maxHeight={maxHeight} autoPanPadding={[32, 32]}
      eventHandlers={{ add: labelCloseButton }}>
      {content}
    </Popup>
  </Marker>
}

function MapBehavior({ onViewChange, onViewportChange, isFullscreen }: Pick<Props, 'onViewChange' | 'onViewportChange' | 'isFullscreen'>) {
  const t = useTranslations('Map.leaflet')
  const map = useMap()
  const reportViewport = useEffectEvent(() => {
    const center = map.getCenter()
    onViewChange?.({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() })
    const bounds = map.getBounds()
    onViewportChange?.({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() })
  })
  useEffect(() => {
    const moveend = () => reportViewport()
    map.on('moveend', moveend)
    return () => { map.off('moveend', moveend) }
  }, [map])
  useEffect(() => { map.fire('moveend') }, [map])
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  useEffect(() => {
    for (const [selector, key] of [['.leaflet-control-zoom-in', 'zoomIn'], ['.leaflet-control-zoom-out', 'zoomOut']] as const) {
      const button = map.getContainer().querySelector<HTMLAnchorElement>(selector)
      if (button) { button.title = t(key); button.setAttribute('aria-label', t(key)) }
    }
  }, [map, t])
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 0)
    return () => window.clearTimeout(timer)
  }, [map, isFullscreen])
  return null
}

function FullscreenControl({ isFullscreen, onToggleFullscreen }: Pick<Props, 'isFullscreen' | 'onToggleFullscreen'>) {
  const map = useMap()
  const t = useTranslations('Map.leaflet')
  const container = useMemo(() => {
    const element = document.createElement('div')
    element.className = 'leaflet-bar leaflet-control-fullscreen'
    leaflet.DomEvent.disableClickPropagation(element)
    return element
  }, [])
  useEffect(() => {
    const control = new leaflet.Control({ position: 'topleft' })
    control.onAdd = () => container
    control.addTo(map)
    return () => { control.remove() }
  }, [map, container])
  const label = t(isFullscreen ? 'exitFullscreen' : 'enterFullscreen')
  return createPortal(<button type="button" className="leaflet-control-zoom-fullscreen" title={label} aria-label={label}
    aria-pressed={isFullscreen} onClick={onToggleFullscreen}>⛶</button>, container)
}

function MessagesControl({ children }: { children: ReactNode }) {
  const map = useMap()
  const container = useMemo(() => {
    const element = document.createElement('div')
    element.className = 'map__messages-control'
    leaflet.DomEvent.disableClickPropagation(element)
    leaflet.DomEvent.disableScrollPropagation(element)
    return element
  }, [])
  useEffect(() => {
    // Leaflet stacks bottom-right controls above the attribution, including when it wraps.
    const control = new leaflet.Control({ position: 'bottomright' })
    control.onAdd = () => container
    control.addTo(map)
    return () => { control.remove() }
  }, [map, container])
  return createPortal(children, container)
}

function GeographicNavigation({ geographicTarget, navigationVersion }: Pick<Props, 'geographicTarget' | 'navigationVersion'>) {
  const map = useMap()
  useEffect(() => {
    if (navigationVersion !== undefined || geographicTarget) map.stop()
    if (geographicTarget) navigateToLocation(map, geographicTarget, prefersReducedMotion())
    return () => { if (map.getContainer().isConnected) map.stop() }
  }, [map, geographicTarget, navigationVersion])
  return null
}

export function ReactLeafletPublicMap({ geographicTarget, navigationVersion, features, onSelect, initialView, apiKey, selectedPublicId, focusSelection, onPreview, selectionVersion, overlay, ...behavior }: Props) {
  const t = useTranslations('Map.leaflet')
  const centered = useRef<string | null>(null)
  configureMarkerIcons(leaflet)
  const view = initialView ?? { latitude: 20, longitude: 0, zoom: 2 }
  const located = features.find(feature => feature.publicId === selectedPublicId)
  return <MapContainer className="map__canvas" center={[view.latitude, view.longitude]} zoom={view.zoom} minZoom={1} maxZoom={19}
    attributionControl={false} zoomControl={false} maxBounds={[[-85.05112878, -Infinity], [85.05112878, Infinity]]} maxBoundsViscosity={1}>
    <AttributionControl prefix={false} />
    <VectorBasemap apiKey={apiKey} attribution={`${VECTOR_ATTRIBUTION} | <a href="https://www.geoapify.com/">Powered by Geoapify</a>`} />
    <ZoomControl position="topleft" zoomInTitle={t('zoomIn')} zoomOutTitle={t('zoomOut')} />
    <FullscreenControl {...behavior} />
    {overlay ? <MessagesControl>{overlay}</MessagesControl> : null}
    <MarkerCluster>{features.filter(feature => feature.publicId !== selectedPublicId).map(feature => <PublicMarker key={feature.publicId} feature={feature} onSelect={onSelect}
      selected={false} centered={centered} onPreview={onPreview} />)}</MarkerCluster>
    {located ? <PublicMarker key={located.publicId} feature={located} onSelect={onSelect} selected centered={centered} focusSelection={focusSelection} selectionVersion={selectionVersion} onPreview={onPreview} /> : null}
    <GeographicNavigation geographicTarget={geographicTarget} navigationVersion={navigationVersion} />
    <MapBehavior {...behavior} />
  </MapContainer>
}
