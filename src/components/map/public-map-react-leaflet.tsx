'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { useLeafletContext } from '@react-leaflet/core'
import leaflet from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import type { PublicMapFeature } from '@/domain/messages/public-message'
import type { LeafletMapProps } from './leaflet-map'
import { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons, createMessageIcon } from './basemap'
import { publicMessageQuery } from './map-queries'
import { MarkerCluster } from './marker-cluster'

type Props = Pick<LeafletMapProps, 'features' | 'onSelect' | 'initialView' | 'onViewChange' | 'onViewportChange' | 'selectedPublicId'> & {
  apiKey: string
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

function MessageContent({ publicId, onSelect, popup }: { publicId: string; onSelect: Props['onSelect']; popup: RefObject<leaflet.Popup | null> }) {
  const t = useTranslations('Map.leaflet')
  const result = useQuery(publicMessageQuery(publicId))
  useLayoutEffect(() => {
    // The query updates inside the portal, so React Leaflet cannot detect its new size.
    // Recalculate before paint so auto-pan uses the loaded letter's height.
    popup.current?.update()
  }, [popup, result.data?.content, result.isError, t])
  if (result.isError || !result.data) return <p className="map-message-popup">{t(result.isError ? 'messageUnavailable' : 'loadingMessage')}</p>
  return <div className="map-message-letter">
    <p className="map-message-popup">{result.data.content}</p>
    <button type="button" className="map-message-read" onClick={() => onSelect(publicId)}>{t('readFullMessage')}</button>
  </div>
}

function PublicMarker({ feature, onSelect, selected, centered }: { feature: PublicMapFeature; onSelect: Props['onSelect']; selected: boolean; centered: RefObject<string | null> }) {
  const t = useTranslations('Map.leaflet')
  const { map, layerContainer } = useLeafletContext()
  const marker = useRef<leaflet.Marker>(null)
  const popup = useRef<leaflet.Popup>(null)
  const [open, setOpen] = useState(false)
  const icon = useMemo(() => createMessageIcon(leaflet), [])
  const position = useMemo<[number, number]>(() => [feature.point.latitude, feature.point.longitude], [feature.point.latitude, feature.point.longitude])
  const title = t('viewMessages', { count: 1 })
  const closeLabel = t('closePopup')
  const labelCloseButton = () => {
    const button = popup.current?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
    if (button) { button.title = closeLabel; button.setAttribute('aria-label', closeLabel) }
  }
  useEffect(() => {
    const element = marker.current?.getElement()
    if (element) element.title = title
    if (marker.current) marker.current.options.title = title
    const button = popup.current?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
    if (button) { button.title = closeLabel; button.setAttribute('aria-label', closeLabel) }
  }, [title, closeLabel])

  useEffect(() => {
    if (!selected || centered.current === feature.publicId) return
    let stopReveal = () => {}
    // Wait for the parent cluster's layer lifecycle to attach it to the map.
    const timer = window.setTimeout(() => {
      const current = marker.current
      if (!current) return
      centered.current = feature.publicId
      const group = layerContainer as leaflet.MarkerClusterGroup
      map.setView(position, 8)
      // zoomToShowLayer has no cancellation API and retains listeners referencing a removed marker.
      // Own the reveal listeners so filtering/removal can dispose them before the next map event.
      const reveal = () => {
        if (!group.hasLayer(current)) return
        if (map.hasLayer(current)) { stopReveal(); current.openPopup(); return }
        const parent = group.getVisibleParent(current)
        if (parent instanceof leaflet.MarkerCluster) parent.spiderfy()
      }
      stopReveal = () => {
        map.off('moveend', reveal)
        group.off('animationend spiderfied', reveal)
      }
      map.on('moveend', reveal)
      group.on('animationend spiderfied', reveal)
      const parent = group.getVisibleParent(current)
      if (parent instanceof leaflet.MarkerCluster) parent.zoomToBounds()
      reveal()
    }, 0)
    return () => { window.clearTimeout(timer); stopReveal() }
  }, [selected, feature.publicId, position, map, layerContainer, centered])

  return <Marker ref={marker} position={position} icon={icon} title={title}
    eventHandlers={{ popupopen: () => setOpen(true), popupclose: () => setOpen(false) }}>
    <Popup ref={popup} className="map-letter-popup" autoClose closeOnClick minWidth={340} maxWidth={340} autoPanPadding={[16, 16]}
      eventHandlers={{ add: labelCloseButton }}>
      {open ? <MessageContent publicId={feature.publicId} onSelect={onSelect} popup={popup} /> : null}
    </Popup>
  </Marker>
}

function MapBehavior({ onViewChange, onViewportChange, isFullscreen }: Pick<Props, 'onViewChange' | 'onViewportChange' | 'isFullscreen'>) {
  const t = useTranslations('Map.leaflet')
  const map = useMapEvents({ moveend: () => {
    const center = map.getCenter()
    onViewChange?.({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() })
    const bounds = map.getBounds()
    onViewportChange?.({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() })
  } })
  useEffect(() => { map.fire('moveend') }, [map])
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

export function ReactLeafletPublicMap({ features, onSelect, initialView, apiKey, selectedPublicId, ...behavior }: Props) {
  const t = useTranslations('Map.leaflet')
  const centered = useRef<string | null>(null)
  configureMarkerIcons(leaflet)
  const view = initialView ?? { latitude: 20, longitude: 0, zoom: 2 }
  return <MapContainer className="map__canvas" center={[view.latitude, view.longitude]} zoom={view.zoom} maxZoom={19}
    zoomControl={false} maxBounds={[[-85.05112878, -Infinity], [85.05112878, Infinity]]} maxBoundsViscosity={1}>
    <TileLayer url={cartoTileUrl(apiKey)} attribution={CARTO_ATTRIBUTION} maxZoom={19} />
    <ZoomControl position="topleft" zoomInTitle={t('zoomIn')} zoomOutTitle={t('zoomOut')} />
    <FullscreenControl {...behavior} />
    <MarkerCluster>{features.map(feature => <PublicMarker key={feature.publicId} feature={feature} onSelect={onSelect}
      selected={feature.publicId === selectedPublicId} centered={centered} />)}</MarkerCluster>
    <MapBehavior {...behavior} />
  </MapContainer>
}
