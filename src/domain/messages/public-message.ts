import type {
  LocationPrecision,
  Recipient,
} from '../contracts'

export type PublicPoint = {
  latitude: number
  longitude: number
}

export type PublicAuthor = {
  publicId: string
  username: string
  displayName: string
}

export interface PublicMapFeature {
  publicId: string
  point: PublicPoint
  precision: LocationPrecision
  locality: string | null
  country: string
  recipient: Recipient
  publishedAt: string
  author: PublicAuthor
}

export interface PublicMessageDetail extends PublicMapFeature {
  content: string
}

export type PublicUser = {
  publicId: string
  username: string
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
  recipient: string | null
  published_at: string
  author_public_id: string
  username: string
  display_name: string
}): PublicMapFeature {
  return {
    publicId: row.public_id,
    point: { latitude: row.latitude, longitude: row.longitude },
    precision: row.location_precision as LocationPrecision,
    locality: row.locality,
    country: row.country,
    recipient: row.recipient as Recipient,
    publishedAt: row.published_at,
    author: {
      publicId: row.author_public_id,
      username: row.username,
      displayName: row.display_name,
    },
  }
}