import type { MapBounds } from '@/domain/messages/public-message'
import type { PublicPoint } from './public-point'

export interface GeographicLocation {
  id: string
  kind: 'country' | 'city'
  name: string
  country: string
  countryCode: string
  point: PublicPoint
  bounds: MapBounds | null
  providerId: string | null
  provider: 'Geoapify'
  attribution: string
  obtainedAt: string
}
export interface GeographicQuery {
  kind: GeographicLocation['kind']
  name: string
  country?: string
}
