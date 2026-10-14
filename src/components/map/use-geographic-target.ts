'use client'
import { useQuery } from '@tanstack/react-query'
import type { GeographicLocation } from '@/domain/location/geographic-location'
import type { MapFilterValues } from './map-filters'
import { normalizeCitySearch } from '@/domain/location/city-search'

export function useGeographicTarget(filters: MapFilterValues, enabled: boolean) {
  const eligible = Boolean(filters.locationId || filters.country)
  const query = useQuery({
    queryKey: ['geographic-location', filters.locationId ?? '', filters.country ?? ''],
    enabled: enabled && eligible,
    retry: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const params = filters.locationId ? new URLSearchParams({ id: filters.locationId }) : new URLSearchParams({ country: filters.country! })
      const response = await fetch(`/api/map/locations?${params}`, { signal })
      if (!response.ok) throw new Error('Location unavailable')
      const data = await response.json() as { locations: GeographicLocation[] }
      if (data.locations.length !== 1) throw new Error('Location unavailable')
      return data.locations[0]
    },
  })
  const location = query.data
  const matches = location && (!filters.country || location.countryCode === filters.country) && (location.kind === 'country' ? !filters.locationId : normalizeCitySearch(location.name) === normalizeCitySearch(filters.city ?? ''))
  return { target: enabled && eligible && matches ? location : undefined, unavailable: enabled && eligible && (query.isError || Boolean(location && !matches)) }
}
