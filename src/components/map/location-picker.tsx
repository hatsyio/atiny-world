'use client'

import 'leaflet/dist/leaflet.css'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { PublicPoint } from '@/domain/location/public-point'
import type { LocationPrecision } from '@/domain/contracts'

import { CARTO_ATTRIBUTION, cartoTileUrl, configureMarkerIcons } from './leaflet-map'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 400

const copy = {
  en: {
    fieldset: 'Publish location',
    addressLabel: 'Search for a city or area',
    addressPlaceholder: 'Type a city or area…',
    loading: 'Searching places…',
    noResults: 'No places found for this search.',
    rateLimited: 'The place search is busy right now. Wait a moment and try again.',
    unavailable: 'The place search is not available right now.',
    retry: 'Try again',
    suggestionsLabel: 'Suggested places',
    selectedLabel: 'Selected place',
    change: 'Change place',
    precisionLabel: 'Location precision',
    approximate: 'Approximate location',
    approximateHint: 'Shows the area around the chosen place without revealing an exact address.',
    precise: 'Exact location',
    preciseHint: 'Lets you place the exact public point on the map.',
    preciseControls: 'Drag the marker to place the exact public point.',
    preciseWarning: 'This point will be public: everyone will see it on the map.',
    preciseConfirm: 'I understand, make this point public',
    preciseConfirmed: 'Exact point confirmed.',
    coordinates: 'Public point',
    attribution: 'Places by Geoapify',
    mapUnavailable: 'The map preview could not be loaded. Try again.',
  },
  es: {
    fieldset: 'Ubicación de publicación',
    addressLabel: 'Busca una ciudad o zona',
    addressPlaceholder: 'Escribe una ciudad o zona…',
    loading: 'Buscando lugares…',
    noResults: 'No se encontraron lugares para esta búsqueda.',
    rateLimited: 'La búsqueda de lugares está saturada. Espera un momento e inténtalo de nuevo.',
    unavailable: 'La búsqueda de lugares no está disponible ahora mismo.',
    retry: 'Reintentar',
    suggestionsLabel: 'Lugares sugeridos',
    selectedLabel: 'Lugar seleccionado',
    change: 'Cambiar lugar',
    precisionLabel: 'Precisión de la ubicación',
    approximate: 'Ubicación aproximada',
    approximateHint: 'Muestra la zona alrededor del lugar elegido sin revelar una dirección exacta.',
    precise: 'Ubicación exacta',
    preciseHint: 'Te permite colocar el punto público exacto en el mapa.',
    preciseControls: 'Arrastra el marcador para colocar el punto público exacto.',
    preciseWarning: 'Este punto será público: todo el mundo lo verá en el mapa.',
    preciseConfirm: 'Lo entiendo, hacer público este punto',
    preciseConfirmed: 'Punto exacto confirmado.',
    coordinates: 'Punto público',
    attribution: 'Lugares de Geoapify',
    mapUnavailable: 'No se pudo cargar la vista previa del mapa. Inténtalo de nuevo.',
  },
} as const

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
  lang?: 'en' | 'es'
  onChange: (value: LocationPickerSelection | null) => void
}

function suggestionLabel(suggestion: LocationSuggestion): string {
  return `${suggestion.locality}, ${suggestion.country}`
}

function PreciseMap({
  point,
  onPointChange,
  lang,
}: {
  point: PublicPoint
  onPointChange: (point: PublicPoint) => void
  lang: 'en' | 'es'
}) {
  const element = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const t = copy[lang === 'es' ? 'es' : 'en']

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
          .map(element.current, { attributionControl: true, zoomControl: true })
          .setView([point.latitude, point.longitude], 14)

        const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
        if (apiKey) {
          leaflet.tileLayer(cartoTileUrl(apiKey), {
            attribution: CARTO_ATTRIBUTION,
            maxZoom: 19,
          }).addTo(instance)
        }

        const marker = leaflet.marker([point.latitude, point.longitude], { draggable: true }).addTo(instance)
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
      instance?.remove()
      instance = null
    }
    // The preview mounts for each precise session: the draft point lives in the
    // picker, and dragging must never remount the map around a moving marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (unavailable) return <p role="alert">{t.mapUnavailable}</p>

  return <div ref={element} className="location-picker__precise-map" aria-label={t.preciseControls} />
}

export function LocationPicker({ lang = 'en', onChange }: LocationPickerProps) {
  const t = copy[lang === 'es' ? 'es' : 'en']
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LocationSearchStatus>('idle')
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [selected, setSelected] = useState<LocationSuggestion | null>(null)
  const [precision, setPrecision] = useState<LocationPrecision>('approximate')
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
    setPrecision('approximate')
    setPrecisePoint(null)
    setPreciseConfirmed(false)
  }, [])

  useEffect(() => {
    const text = query.trim()
    if (text.length < MIN_QUERY_LENGTH) return
    const timer = setTimeout(() => void search(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => () => controller.current?.abort(), [])

  function handleQueryChange(next: string) {
    setQuery(next)
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
    setPrecision('approximate')
    setPrecisePoint(null)
    setPreciseConfirmed(false)
    onChange({ selectionId: suggestion.selectionToken, precision: 'approximate' })
  }

  function handlePrecisionChange(next: LocationPrecision) {
    if (selected === null) return
    setPrecision(next)
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

  const failure = status === 'rateLimited' || status === 'unavailable'

  return (
    <fieldset className="location-picker">
      <legend>{t.fieldset}</legend>

      <label htmlFor="location-address">{t.addressLabel}</label>
      <input
        id="location-address"
        type="text"
        autoComplete="off"
        value={query}
        placeholder={t.addressPlaceholder}
        aria-describedby={selected !== null ? undefined : 'location-search-status'}
        onChange={(event) => handleQueryChange(event.target.value)}
      />

      {status === 'loading' && !failure && selected === null && (
        <p id="location-search-status" role="status">{t.loading}</p>
      )}
      {status === 'empty' && selected === null && (
        <p id="location-search-status" role="status">{t.noResults}</p>
      )}
      {failure && selected === null && (
        <div id="location-search-status" role="alert">
          <p>{status === 'rateLimited' ? t.rateLimited : t.unavailable}</p>
          <button type="button" onClick={retrySearch}>{t.retry}</button>
        </div>
      )}

      {status === 'ready' && selected === null && (
        <div role="listbox" aria-label={t.suggestionsLabel}>
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

      {selected !== null && (
        <section aria-label={t.selectedLabel} className="location-picker__selection">
          <p className="location-picker__selection-label">{suggestionLabel(selected)}</p>

          <fieldset>
            <legend>{t.precisionLabel}</legend>
            <label>
              <input
                type="radio"
                name="location-precision"
                checked={precision === 'approximate'}
                onChange={() => handlePrecisionChange('approximate')}
              />
              <span>{t.approximate}</span>
            </label>
            <p>{t.approximateHint}</p>
            <label>
              <input
                type="radio"
                name="location-precision"
                checked={precision === 'precise'}
                onChange={() => handlePrecisionChange('precise')}
              />
              <span>{t.precise}</span>
            </label>
            <p>{t.preciseHint}</p>
          </fieldset>

          {precision === 'precise' && (
            <div className="location-picker__precise">
              <p className="location-picker__precise-controls">{t.preciseControls}</p>
              <PreciseMap
                point={precisePoint ?? selected.point}
                onPointChange={setPrecisePoint}
                lang={lang}
              />
              <p className="location-picker__coordinates">
                {t.coordinates}:{' '}
                {precisePoint === null
                  ? '—'
                  : `${precisePoint.latitude.toFixed(5)}, ${precisePoint.longitude.toFixed(5)}`}
              </p>
              {!preciseConfirmed ? (
                <div className="location-picker__warning">
                  <p>{t.preciseWarning}</p>
                  <button type="button" onClick={confirmPrecise}>{t.preciseConfirm}</button>
                </div>
              ) : (
                <p role="status">{t.preciseConfirmed}</p>
              )}
            </div>
          )}

          <p className="location-picker__attribution">{t.attribution}</p>
          <button type="button" onClick={() => {
            resetSelection()
            onChange(null)
          }}>{t.change}</button>
        </section>
      )}
    </fieldset>
  )
}
