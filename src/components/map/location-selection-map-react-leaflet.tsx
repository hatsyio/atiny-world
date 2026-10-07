'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import * as leaflet from 'leaflet'
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet'
import type { LocationSelectionMapProps } from './location-selection-map'
import { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons } from './basemap'

function publicPoint(position: leaflet.LatLng) {
  const longitude = position.lng >= -180 && position.lng <= 180 ? position.lng : ((position.lng + 180) % 360 + 360) % 360 - 180
  return { latitude: position.lat, longitude }
}

function SelectionControls({ point, focusPoint, precise, onPointChange }: LocationSelectionMapProps) {
  const t = useTranslations('Forms.location')
  const controls = useTranslations('Map.controls')
  const marker = useRef<leaflet.Marker>(null)
  const latitude = point?.latitude
  const longitude = point?.longitude
  const focusLatitude = focusPoint?.latitude
  const focusLongitude = focusPoint?.longitude
  const position = useMemo<[number, number] | undefined>(() => latitude !== undefined && longitude !== undefined ? [latitude, longitude] : undefined, [latitude, longitude])
  const icon = useMemo(() => { configureMarkerIcons(leaflet); return new leaflet.Icon.Default() }, [])
  const label = t(precise ? 'precisePointLabel' : 'mapPointLabel')
  const hint = t('mapSelectHint')
  const map = useMapEvents({ click: event => onPointChange(publicPoint(event.latlng)) })

  useEffect(() => {
    map.getContainer().setAttribute('aria-label', hint)
    const image = marker.current?.getElement()
    if (image) { image.setAttribute('alt', label); image.title = label }
  }, [map, hint, label, position])

  useEffect(() => {
    if (position && !map.getBounds().contains(position)) map.panTo(position)
  }, [map, position])

  useEffect(() => {
    if (focusLatitude !== undefined && focusLongitude !== undefined) map.setView([focusLatitude, focusLongitude], 14)
    // Coordinate equality preserves exploration when a parent supplies a new object.
  }, [map, focusLatitude, focusLongitude])

  return <>
    <ZoomControl key={`${controls('zoomIn')}:${controls('zoomOut')}`} zoomInTitle={controls('zoomIn')} zoomOutTitle={controls('zoomOut')} />
    {position && <Marker ref={marker} position={position} icon={icon} draggable alt={label} title={label}
      eventHandlers={{ dragend: event => onPointChange(publicPoint((event.target as leaflet.Marker).getLatLng())) }} />}
    <button ref={button => { if (button) leaflet.DomEvent.disableClickPropagation(button) }} className="location-selection-map__center" type="button" onClick={event => {
      event.stopPropagation()
      onPointChange(publicPoint(map.getCenter()))
    }}>{t('useMapCenter')}</button>
  </>
}

export function ReactLeafletSelectionMap(props: LocationSelectionMapProps & { apiKey: string }) {
  return <MapContainer className="location-picker__precise-map" center={props.point ? [props.point.latitude, props.point.longitude] : [20, 0]}
    zoom={props.point ? 14 : 2} attributionControl zoomControl={false} scrollWheelZoom={false}>
    <TileLayer url={cartoTileUrl(props.apiKey)} attribution={CARTO_ATTRIBUTION} maxZoom={19} />
    <SelectionControls {...props} />
  </MapContainer>
}
