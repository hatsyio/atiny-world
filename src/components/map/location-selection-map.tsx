'use client'

import 'leaflet/dist/leaflet.css'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { PublicPoint } from '@/domain/location/public-point'
import { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons } from './basemap'

function wrapLongitude(longitude: number): number {
  return longitude >= -180 && longitude <= 180 ? longitude : ((longitude + 180) % 360 + 360) % 360 - 180
}

export function LocationSelectionMap({ point, focusPoint, precise, onPointChange }: {
  point?: PublicPoint
  focusPoint?: PublicPoint
  precise: boolean
  onPointChange: (point: PublicPoint) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<import('leaflet').Map | null>(null)
  const marker = useRef<import('leaflet').Marker | null>(null)
  const leaflet = useRef<typeof import('leaflet') | null>(null)
  const latestPoint = useRef(point)
  const onSelect = useRef(onPointChange)
  const t = useTranslations('Forms.location')
  const controls = useTranslations('Map.controls')
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  const labels = useRef({ zoomIn: controls('zoomIn'), zoomOut: controls('zoomOut'), point: t(precise ? 'precisePointLabel' : 'mapPointLabel') })

  useEffect(() => { latestPoint.current = point; onSelect.current = onPointChange }, [point, onPointChange])

  useEffect(() => {
    labels.current = { zoomIn: controls('zoomIn'), zoomOut: controls('zoomOut'), point: t(precise ? 'precisePointLabel' : 'mapPointLabel') }
    for (const [selector, title] of [['.leaflet-control-zoom-in', labels.current.zoomIn], ['.leaflet-control-zoom-out', labels.current.zoomOut]]) {
      element.current?.querySelectorAll<HTMLElement>(selector).forEach(button => {
        button.title = title
        button.setAttribute('aria-label', title)
      })
    }
    const image = marker.current?.getElement()
    if (image) { image.setAttribute('alt', labels.current.point); image.title = labels.current.point }
  }, [controls, t, precise, ready])

  useEffect(() => {
    let disposed = false
    async function mount() {
      if (!apiKey) return
      try {
        const leafletModule = await import('leaflet')
        if (disposed || !element.current) return
        const api = leafletModule.default ?? leafletModule
        leaflet.current = api
        configureMarkerIcons(api)
        const initial = latestPoint.current
        const instance = api.map(element.current, { attributionControl: true, zoomControl: false, scrollWheelZoom: false })
          .setView(initial ? [initial.latitude, initial.longitude] : [20, 0], initial ? 14 : 2)
        map.current = instance
        api.control.zoom({ zoomInTitle: labels.current.zoomIn, zoomOutTitle: labels.current.zoomOut }).addTo(instance)
        if (apiKey) api.tileLayer(cartoTileUrl(apiKey), { attribution: CARTO_ATTRIBUTION, maxZoom: 19 }).addTo(instance)
        instance.on('click', (event: import('leaflet').LeafletMouseEvent) => {
          onSelect.current({ latitude: event.latlng.lat, longitude: wrapLongitude(event.latlng.lng) })
        })
        setReady(true)
      } catch { if (!disposed) setUnavailable(true) }
    }
    void mount()
    return () => {
      disposed = true
      map.current?.remove()
      map.current = null
      marker.current = null
      leaflet.current = null
    }
  }, [apiKey])

  useEffect(() => {
    const instance = map.current
    const api = leaflet.current
    if (!ready || !instance || !api) return
    if (!point) { marker.current?.remove(); marker.current = null; return }
    const position: [number, number] = [point.latitude, point.longitude]
    if (marker.current) marker.current.setLatLng(position)
    else {
      const pin = api.marker(position, { draggable: true, alt: labels.current.point, title: labels.current.point }).addTo(instance)
      pin.on('dragend', () => {
        const position = pin.getLatLng()
        onSelect.current({ latitude: position.lat, longitude: wrapLongitude(position.lng) })
      })
      marker.current = pin
    }
    if (!instance.getBounds().contains(position)) instance.panTo(position)
  }, [point?.latitude, point?.longitude, point, ready])

  useEffect(() => {
    if (ready && focusPoint) map.current?.setView([focusPoint.latitude, focusPoint.longitude], 14)
  }, [ready, focusPoint])

  return (
    <div className="location-selection-map">
      <div ref={element} className="location-picker__precise-map" aria-label={t('mapSelectHint')} tabIndex={0} />
      {unavailable || !apiKey ? <p className="location-selection-map__unavailable">{t('mapUnavailable')}</p> : null}
      {!unavailable && ready ? <button className="location-selection-map__center" type="button" onClick={() => {
        const center = map.current?.getCenter()
        if (center) onSelect.current({ latitude: center.lat, longitude: wrapLongitude(center.lng) })
      }}>{t('useMapCenter')}</button> : null}
    </div>
  )
}
