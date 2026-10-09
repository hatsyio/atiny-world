'use client'

import { useEffect, useEffectEvent, useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { mapCountries } from '@/i18n/countries'
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

export function MapFilters({ value, onChange, debounceMs = 0 }: Props) {
  const locale = useLocale()
  const cityId = useId()
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
  const countries = mapCountries[locale]
  const t = useTranslations('Map.filters')
  return (
    <div className="map-filters" role="group" aria-label={t('filters')}>
      <label htmlFor={cityId}>{t('city')}</label>
      <input
        id={cityId}
        type="text"
        name="city"
        aria-label={t('city')}
        value={city}
        maxLength={MAX_TEXT_FILTER_LENGTH}
        onChange={(event) => {
          setCity(event.target.value)
          if (!debounceMs) onChange({ ...value, city: normalizeTextFilter(event.target.value) })
        }}
      />

      <AppSelect label={t('country')} name="country" variant="paper" value={normalizeCountry(value.country ?? '')} onChange={country => onChange({ ...value, country: normalizeCountry(country) })} options={[{ value: '', label: t('all') }, ...countries]} />
      {value.city || value.country || city ? <button className="map-filters__clear" type="button" onClick={() => { setCity(''); onChange({ city: '', country: '' }) }}>{t('clear')}</button> : null}
    </div>
  )
}
