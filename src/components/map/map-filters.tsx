'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { mapCountries } from '@/i18n/countries'
import { useQuery } from '@tanstack/react-query'
import { publicLocationOptionsQuery } from './map-queries'
import { AppCityInput } from '@/components/ui/app-city-input'
import { AppSelect } from '@/components/ui/app-select'

export interface MapFilterValues {
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
  const applyCity = useEffectEvent((city: string) => onChange({ ...value, city }))
  useEffect(() => {
    if (!debounceMs || normalizeTextFilter(city) === (value.city ?? '')) return
    const timer = window.setTimeout(() => applyCity(normalizeTextFilter(city)), debounceMs)
    return () => window.clearTimeout(timer)
  }, [city, value.city, debounceMs])
  // Catalog order and names are identical in Node and browsers with different ICU data.
  const availableCountries = new Set(locations.map(location => location.country))
  const countries = mapCountries[locale].filter(option => availableCountries.has(option.value))
  const t = useTranslations('Map.filters')
  return (
    <div className="map-filters" role="group" aria-label={t('filters')} aria-busy={optionsQuery.isPending}>
      <AppCityInput label={t('city')} value={city} locations={locations} country={value.country}
        onChange={next => {
          setCity(next)
          if (!debounceMs) onChange({ ...value, city: normalizeTextFilter(next) })
        }} />
      <AppSelect
        disabled={optionsQuery.isPending || optionsQuery.isError}
        label={t('country')}
        name="country"
        variant="paper"
        placeholder={t(optionsQuery.isPending ? 'loadingOptions' : 'countryUnavailable')}
        value={normalizeCountry(value.country ?? '')}
        onChange={country => onChange({ ...value, country: normalizeCountry(country) })}
        options={[{ value: '', label: t('all') }, ...countries]}
      />
      {optionsQuery.isError ? <div role="status"><p>{t('optionsUnavailable')}</p><button type="button" onClick={() => void optionsQuery.refetch()}>{t('retry')}</button></div> : null}
    </div>
  )
}
