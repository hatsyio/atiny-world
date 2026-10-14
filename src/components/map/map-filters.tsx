'use client'

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { mapCountries } from '@/i18n/countries'
import { useQuery } from '@tanstack/react-query'
import { publicLocationOptionsQuery } from './map-queries'
import { AppCityInput } from '@/components/ui/app-city-input'
import type { GeographicLocation } from '@/domain/location/geographic-location'
import { AppSelect } from '@/components/ui/app-select'

export interface MapFilterValues {
  locationId?: string
  city?: string
  country?: string
}

interface Props {
  value: MapFilterValues
  onChange: (values: MapFilterValues) => void
  debounceMs?: number
}

const MAX_TEXT_FILTER_LENGTH = 100

function normalizeTextFilter(value: string): string {
  return [...value.trim()].slice(0, MAX_TEXT_FILTER_LENGTH).join('')
}

function normalizeCountry(value: string): string {
  const country = value.trim().toLowerCase()
  return mapCountries.en.some(option => option.value === country) ? country : ''
}

export function MapFilters({ value, onChange, debounceMs = 350 }: Props) {
  const locale = useLocale()
  const optionsQuery = useQuery(publicLocationOptionsQuery())
  const locations = optionsQuery.isError ? [] : optionsQuery.data?.locations ?? []
  const [city, setCity] = useState(value.city ?? '')
  const [appliedCity, setAppliedCity] = useState(value.city ?? '')
  if ((value.city ?? '') !== appliedCity) {
    setAppliedCity(value.city ?? '')
    setCity(value.city ?? '')
  }
  const applyCity = useEffectEvent((city: string) => onChange({ ...value, city, ...(value.locationId ? { locationId: undefined } : {}) }))
  useEffect(() => {
    if (!debounceMs || normalizeTextFilter(city) === (value.city ?? '')) return
    const timer = window.setTimeout(() => applyCity(normalizeTextFilter(city)), debounceMs)
    return () => window.clearTimeout(timer)
  }, [city, value.city, debounceMs])
  // Catalog order and names are identical in Node and browsers with different ICU data.
  const availableCountries = new Set(locations.map(location => location.country))
  const countries = mapCountries[locale].filter(country => availableCountries.has(country.value))
  const t = useTranslations('Map.filters')
  const request = useRef<AbortController | null>(null)
  const pendingSelection = useRef<{ name: string; initialCountry?: string; initialId?: string } | null>(null)
  // Toolbar and fullscreen filters share a value. A selection in either one
  // invalidates requests from the other, while our own text debounce is allowed.
  useLayoutEffect(() => {
    const pending = pendingSelection.current
    if (pending && (value.city !== pending.name ||
      value.country !== pending.initialCountry ||
      value.locationId !== undefined && value.locationId !== pending.initialId)) request.current?.abort()
  }, [value.city, value.country, value.locationId])
  const [resolution, setResolution] = useState<{ context: string; locations: GeographicLocation[]; pending: boolean; failed: boolean } | null>(null)
  const context = JSON.stringify([city, value.country])
  useEffect(() => () => request.current?.abort(), [])
  const searchCity = async (name: string, country: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    pendingSelection.current = { name, initialCountry: value.country, initialId: value.locationId }
    const context = JSON.stringify([name, value.country])
    setResolution({ context, locations: [], pending: true, failed: false })
    try {
      const params = new URLSearchParams({ city: normalizeTextFilter(name) })
      params.set('country', country)
      const response = await fetch(`/api/map/locations?${params}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Location unavailable')
      const data = await response.json() as { locations: GeographicLocation[] }
      if (controller.signal.aborted) return
      if (data.locations.length === 1) {
        setResolution(null)
        onChange({ city: name, country, locationId: data.locations[0].id })
      } else setResolution({ context, locations: data.locations, pending: false, failed: false })
    } catch {
      if (!controller.signal.aborted) setResolution({ context, locations: [], pending: false, failed: true })
    }
  }
  const currentResolution = resolution?.context === context ? resolution : null
  return (
    <div className="map-filters" role="group" aria-label={t('filters')} aria-busy={optionsQuery.isPending}>
      <AppCityInput label={t('city')} value={city} locations={locations} country={value.country}
        onSelect={(name, country) => { void searchCity(name, country) }} onChange={next => {
          request.current?.abort()
          setResolution(null)
          setCity(next)
          if (!debounceMs) onChange({ ...value, city: normalizeTextFilter(next), ...(value.locationId ? { locationId: undefined } : {}) })
        }} />
      <AppSelect
        disabled={optionsQuery.isPending || optionsQuery.isError}
        label={t('country')}
        name="country"
        variant="paper"
        placeholder={t(optionsQuery.isPending ? 'loadingOptions' : 'countryUnavailable')}
        value={normalizeCountry(value.country ?? '')}
        onChange={country => { request.current?.abort(); setResolution(null); onChange({ ...value, country: normalizeCountry(country), ...(value.locationId ? { locationId: undefined } : {}) }) }}
        options={[{ value: '', label: t('all') }, ...countries]}
      />
      {currentResolution ? <div className="map-location-results" aria-live="polite">
        {currentResolution.pending ? <p role="status">{t('locating')}</p> : null}
        {currentResolution.failed ? <p role="status">{t('locationUnavailable')}</p> : null}
        {!currentResolution.pending && !currentResolution.failed && !currentResolution.locations.length ? <p role="status">{t('locationNotFound')}</p> : null}
        {currentResolution.locations.map(location => <button key={location.id} type="button" onClick={() => {
          request.current?.abort()
          setResolution(null)
          onChange({ city, country: location.countryCode, locationId: location.id })
        }}>{location.name} · {location.country} ({location.point.latitude.toFixed(3)}, {location.point.longitude.toFixed(3)})</button>)}
        {currentResolution.locations.length ? <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> : null}
      </div> : null}
      {optionsQuery.isError ? <div role="status"><p>{t('optionsUnavailable')}</p><button type="button" onClick={() => void optionsQuery.refetch()}>{t('retry')}</button></div> : null}
    </div>
  )
}
