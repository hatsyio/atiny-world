'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import * as leaflet from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { PublicPoint } from '@/domain/messages/public-message'
import { CARTO_ATTRIBUTION, cartoTileUrl, createMessageIcon } from './basemap'

function translateCloseButton(popup: leaflet.Popup | null, label: string) {
  const button = popup?.getElement()?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button')
  if (button) {
    button.setAttribute('aria-label', label)
    button.title = label
  }
}

export function ReactLeafletLetterMap({ point, content, apiKey }: { point: PublicPoint; content: string; apiKey: string }) {
  const t = useTranslations('Map.leaflet')
  const icon = useMemo(() => createMessageIcon(leaflet), [])
  const position = useMemo<[number, number]>(() => [point.latitude, point.longitude], [point.latitude, point.longitude])
  const marker = useRef<leaflet.Marker>(null)
  const popup = useRef<leaflet.Popup>(null)
  const markerTitle = t('viewMessages', { count: 1 })
  const closeLabel = t('closePopup')

  // Marker title is not mutable in React Leaflet; update its accessible DOM label.
  useEffect(() => {
    const element = marker.current?.getElement()
    if (element) element.title = markerTitle
    translateCloseButton(popup.current, closeLabel)
  }, [markerTitle, closeLabel])

  return (
    <MapContainer
      key={`${point.latitude}:${point.longitude}`}
      className="map__canvas"
      center={position}
      zoom={15}
      attributionControl
      zoomControl={false}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
    >
      <TileLayer url={cartoTileUrl(apiKey)} attribution={CARTO_ATTRIBUTION} maxZoom={19} />
      <Marker ref={marker} position={position} icon={icon} title={markerTitle} autoPanOnFocus={false}>
        <Popup
          ref={popup}
          className="map-letter-popup"
          autoPan={false}
          minWidth={240}
          maxWidth={340}
          maxHeight={90}
          eventHandlers={{ add: event => translateCloseButton(event.target as leaflet.Popup, closeLabel) }}
        >
          <p className="map-message-popup">{content}</p>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
