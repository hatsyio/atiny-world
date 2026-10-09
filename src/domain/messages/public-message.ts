import type { LocationPrecision } from '../contracts'

import type { PublicPoint } from '../location/public-point'
export type { PublicPoint } from '../location/public-point'

export type PublicAuthor = {
  publicId: string
  displayName: string
}

export interface PublicMapFeature {
  publicId: string
  point: PublicPoint
  precision: LocationPrecision
  locality: string | null
  country: string
  countryCode: string
  publishedAt: string
  author: PublicAuthor
}

export interface PublicMessageDetail extends PublicMapFeature {
  content: string
}

export type PublicUser = {
  publicId: string
  displayName: string
}

export interface MapBounds {
  west: number
  south: number
  east: number
  north: number
}

export function projectPublicFeature(row: {
  public_id: string
  latitude: number
  longitude: number
  location_precision: string
  locality: string | null
  country: string
  country_code: string
  published_at: string | Date
  author_public_id: string
  display_name: string
}): PublicMapFeature {
  return {
    publicId: row.public_id,
    point: { latitude: row.latitude, longitude: row.longitude },
    precision: row.location_precision as LocationPrecision,
    locality: row.locality,
    country: row.country,
    countryCode: row.country_code,
    publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : row.published_at,
    author: {
      publicId: row.author_public_id,
      displayName: row.display_name,
    },
  }
}
