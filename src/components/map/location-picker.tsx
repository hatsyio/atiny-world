'use client'

import type { Locale } from '@/i18n/locale'

import { useFormatter, useLocale, useTranslations } from 'next-intl'

import 'leaflet/dist/leaflet.css'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { PublicPoint } from '@/domain/location/public-point'
import type { LocationPrecision } from '@/domain/contracts'

import { LetterLocationMap } from './letter-location-map'
import { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons } from './leaflet-map'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 400


export type LocationPickerSelection =
  | { selectionId: string; precision: 'approximate' }
  | {
      selectionId: string
      precision: 'precise'
      confirmedPublicPoint: PublicPoint
      preciseLocationConfirmed: true
    }

export type LocationSearchStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'rateLimited'
  | 'unavailable'

export type LocationSuggestion = {
  locality: string
  country: string
  countryCode: string
  point: PublicPoint
  sourceAttribution: { label: string; url: string }
  selectionToken: string
}

export interface LocationPickerProps {
  lang?: Locale
  onChange: (value: LocationPickerSelection | null) => void
  initialLocation?: { point?: PublicPoint; precision: LocationPrecision; locality: string | null; country: string }
  readOnly?: boolean
  content?: string
  onPendingChange?: (pending: boolean) => void
}

function suggestionLabel(suggestion: LocationSuggestion): string {
  return `${suggestion.locality}, ${suggestion.country}`
}

function PreciseMap({
  point,
  onPointChange,
}: {
  point: PublicPoint
  onPointChange: (point: PublicPoint) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const t = useTranslations('Forms.location')
  const controls = useTranslations('Map.controls')
  const labels = useRef({zoomIn: controls('zoomIn'), zoomOut: controls('zoomOut'), point: t('precisePointLabel')})
  const preciseMarker = useRef<import('leaflet').Marker | null>(null)
  useEffect(() => {
    labels.current = {zoomIn: controls('zoomIn'), zoomOut: controls('zoomOut'), point: t('precisePointLabel')}
    for (const [selector, title] of [['.leaflet-control-zoom-in', labels.current.zoomIn], ['.leaflet-control-zoom-out', labels.current.zoomOut]]) {
      element.current?.querySelectorAll<HTMLElement>(selector).forEach((button) => {
        button.title = title
        button.setAttribute('aria-label', title)
      })
    }
    const markerElement = preciseMarker.current?.getElement()
    if (markerElement) {
      markerElement.setAttribute('alt', labels.current.point)
      markerElement.title = labels.current.point
    }
  }, [controls, t])

  useEffect(() => {
    let disposed = false
    let instance: import('leaflet').Map | null = null

    async function mountMap() {
      try {
        type LeafletModule = typeof import('leaflet')
        const leafletModule = await import('leaflet')
        if (disposed || !element.current) return
        const leaflet = (leafletModule as { default?: LeafletModule }).default ?? leafletModule
        configureMarkerIcons(leaflet)
        instance = leaflet
          .map(element.current, { attributionControl: true, zoomControl: false })
          .setView([point.latitude, point.longitude], 14)
        leaflet.control.zoom({zoomInTitle: labels.current.zoomIn, zoomOutTitle: labels.current.zoomOut}).addTo(instance)

        const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
        if (apiKey) {
          leaflet.tileLayer(cartoTileUrl(apiKey), {
            attribution: CARTO_ATTRIBUTION,
            maxZoom: 19,
          }).addTo(instance)
        }

        const marker = leaflet.marker([point.latitude, point.longitude], { draggable: true, alt: labels.current.point, title: labels.current.point }).addTo(instance)
        preciseMarker.current = marker
        marker.on('dragend', () => {
          const position = marker.getLatLng()
          onPointChange({ latitude: position.lat, longitude: position.lng })
        })
      } catch {
        if (!disposed) setUnavailable(true)
      }
    }

    void mountMap()

    return () => {
      disposed = true
      preciseMarker.current = null
      instance?.remove()
      instance = null
    }
    // The preview mounts for each precise session: the draft point lives in the
    // picker, and dragging must never remount the map around a moving marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (unavailable) return <p role="alert">{t('mapUnavailable')}</p>

  return <div ref={element} className="location-picker__precise-map" aria-label={t('preciseControls')} />
}

export function LocationPicker({ onChange, initialLocation, onPendingChange, readOnly = false, content = '' }: LocationPickerProps) {
  const format = useFormatter()
  const lang = useLocale()
  const t = useTranslations('Forms.location')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LocationSearchStatus>('idle')
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [selected, setSelected] = useState<LocationSuggestion | null>(null)
  const [precision, setPrecision] = useState<LocationPrecision>(initialLocation?.precision ?? 'approximate')
  const [precisePoint, setPrecisePoint] = useState<PublicPoint | null>(null)
  const [preciseConfirmed, setPreciseConfirmed] = useState(false)

  const controller = useRef<AbortController | null>(null)
  const attempt = useRef(0)

  const search = useCallback(async (text: string) => {
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    const nextAttempt = attempt.current + 1
    attempt.current = nextAttempt
    setSuggestions([])
    setStatus('loading')

    try {
      const response = await fetch('/api/locations/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: text, language: lang }),
        signal: nextController.signal,
        cache: 'no-store',
      })
      if (nextAttempt !== attempt.current || nextController.signal.aborted) return

      if (response.status === 429) {
        setStatus('rateLimited')
        return
      }
      if (!response.ok) {
        setStatus('unavailable')
        return
      }

      const body = (await response.json()) as { suggestions?: LocationSuggestion[] }
      if (nextAttempt !== attempt.current || nextController.signal.aborted) return

      const next = body.suggestions ?? []
      setSuggestions(next)
      setStatus(next.length === 0 ? 'empty' : 'ready')
    } catch {
      if (nextAttempt !== attempt.current || nextController.signal.aborted) return
      setStatus('unavailable')
    }
  }, [lang])

  const resetSelection = useCallback(() => {
    setSelected(null)
    setPrecision(initialLocation?.precision ?? 'approximate')
    setPrecisePoint(null)
    setPreciseConfirmed(false)
  }, [initialLocation?.precision])

  useEffect(() => {
    if (selected !== null) return
    const text = query.trim()
    if (text.length < MIN_QUERY_LENGTH) return
    const timer = setTimeout(() => void search(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, search, selected])

  useEffect(() => () => controller.current?.abort(), [])

  function handleQueryChange(next: string) {
    setQuery(next)
    onPendingChange?.(next.trim().length > 0)
    if (selected !== null) {
      resetSelection()
      onChange(null)
    }
    controller.current?.abort()
    attempt.current += 1
    if (next.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setStatus('idle')
    }
  }

  function selectSuggestion(suggestion: LocationSuggestion) {
    setSelected(suggestion)
    onPendingChange?.(false)
    setPrecision('approximate')
    setPrecisePoint(null)
    setPreciseConfirmed(false)
    onChange({ selectionId: suggestion.selectionToken, precision: 'approximate' })
  }

  function handlePrecisionChange(next: LocationPrecision) {
    if (selected === null) return
    setPrecision(next)
    onPendingChange?.(next === 'precise')
    if (next === 'approximate') {
      setPrecisePoint(null)
      setPreciseConfirmed(false)
      onChange({ selectionId: selected.selectionToken, precision: 'approximate' })
    } else {
      setPrecisePoint(selected.point)
      setPreciseConfirmed(false)
      onChange(null)
    }
  }

  function confirmPrecise() {
    if (selected === null || precisePoint === null) return
    setPreciseConfirmed(true)
    onPendingChange?.(false)
    onChange({
      selectionId: selected.selectionToken,
      precision: 'precise',
      confirmedPublicPoint: precisePoint,
      preciseLocationConfirmed: true,
    })
  }

  function retrySearch() {
    void search(query.trim())
  }

  const previewPoint = selected?.point ?? initialLocation?.point
  const displayedPrecision = selected !== null ? precision : initialLocation?.precision ?? precision
  const failure = status === 'rateLimited' || status === 'unavailable'

  return (
    <fieldset className="location-picker">
      <legend>{t('fieldset')}</legend>

      <label htmlFor="location-address">{t('addressLabel')}</label>
      <input
        id="location-address"
        type="text"
        autoComplete="off"
        value={readOnly ? [initialLocation?.locality, initialLocation?.country].filter(Boolean).join(', ') : query}
        readOnly={readOnly}
        placeholder={t('addressPlaceholder')}
        aria-describedby={status !== 'idle' && selected === null ? 'location-search-status' : undefined}
        onChange={(event) => handleQueryChange(event.target.value)}
      />

      <div className="location-picker__search-feedback">
        {status === 'loading' && !failure && selected === null && (
          <p id="location-search-status" role="status">{t('loading')}</p>
        )}
        {status === 'empty' && selected === null && (
          <p id="location-search-status" role="status">{t('noResults')}</p>
        )}
        {failure && selected === null && (
          <div id="location-search-status" role="alert">
            <p>{status === 'rateLimited' ? t('rateLimited') : t('unavailable')}</p>
            <button type="button" onClick={retrySearch}>{t('retry')}</button>
          </div>
        )}

        {status === 'ready' && selected === null && (
          <div role="listbox" aria-label={t('suggestionsLabel')}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.selectionToken}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestionLabel(suggestion)}
              </button>
            ))}
          </div>
        )}

      </div>
      <div className="location-picker__summary">
        {selected !== null ? (
          <section aria-label={t('selectedLabel')} className="location-picker__selection">
            <span>{suggestionLabel(selected)}</span>
            <button type="button" onClick={() => {
              resetSelection()
              setQuery('')
              setStatus('idle')
              onPendingChange?.(false)
              onChange(null)
            }}>{t('change')}</button>
          </section>
        ) : <p className="profile-hint">{initialLocation ? [initialLocation.locality, initialLocation.country].filter(Boolean).join(', ') : t('chooseLocation')}</p>}
      </div>
      <fieldset className="location-picker__precision" disabled={selected === null}>
        <legend>{t('precisionLabel')}</legend>
        <label>
          <input type="radio" name="location-precision" checked={displayedPrecision === 'approximate'} onChange={() => handlePrecisionChange('approximate')} />
          <span>{t('approximate')}</span>
        </label>
        <p>{t('approximateHint')}</p>
        <label>
          <input type="radio" name="location-precision" checked={displayedPrecision === 'precise'} onChange={() => handlePrecisionChange('precise')} />
          <span>{t('precise')}</span>
        </label>
        <p>{t('preciseHint')}</p>
      </fieldset>
      <div className="location-picker__map-frame message-map">
        {selected !== null && precision === 'precise' ? (
          <PreciseMap point={precisePoint ?? selected.point} onPointChange={(point) => {
            setPrecisePoint(point)
            setPreciseConfirmed(false)
            onPendingChange?.(true)
            onChange(null)
          }} />
        ) : previewPoint ? (
          <LetterLocationMap point={previewPoint} content={content} />
        ) : <div className="location-picker__map-empty">{t('mapEmpty')}</div>}
      </div>
      <div className="location-picker__map-help">
        {selected !== null && precision === 'precise' ? (
          <div className="location-picker__precise">
            <p className="location-picker__precise-controls">{t('preciseControls')}</p>
            <p className="location-picker__coordinates">
              {t('coordinates')}: {precisePoint === null ? '—' : `${format.number(precisePoint.latitude, {minimumFractionDigits: 5, maximumFractionDigits: 5, useGrouping: false})}, ${format.number(precisePoint.longitude, {minimumFractionDigits: 5, maximumFractionDigits: 5, useGrouping: false})}`}
            </p>
            {!preciseConfirmed ? (
              <div className="location-picker__warning">
                <p>{t('preciseWarning')}</p>
                <button type="button" onClick={confirmPrecise}>{t('preciseConfirm')}</button>
              </div>
            ) : <p role="status">{t('preciseConfirmed')}</p>}
          </div>
        ) : <p className="profile-hint">{readOnly ? t(displayedPrecision === 'precise' ? 'preciseHint' : 'approximateHint') : initialLocation ? t('keepLocation') : t('approximateHint')}</p>}
      </div>
      <p className="location-picker__attribution">{t('attribution')}</p>
    </fieldset>
  )
}
