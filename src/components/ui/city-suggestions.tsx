'use client'

import type { PublicLetterLocation } from '@/domain/location/public-locations'
import { useAutoFilterField } from './auto-filter-form'

/** Native autocomplete keeps the existing text search and keyboard interaction. */
export function CitySuggestions({ id, locations, country = '' }: {
  id: string
  locations: PublicLetterLocation[]
  country?: string
}) {
  const filters = useAutoFilterField()
  const selectedCountry = filters?.values.country ?? country
  const cities = [...new Set(locations
    .filter(location => !selectedCountry || location.country === selectedCountry)
    .map(location => location.city)
    .filter((city): city is string => Boolean(city)))].sort()
  return <datalist id={id}>{cities.map(city => <option key={city} value={city} />)}</datalist>
}
