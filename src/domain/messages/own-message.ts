import type { LocationPrecision, MessageStatus, Recipient } from '../contracts'

export interface OwnMessage {
  publicId: string
  version: number
  status: MessageStatus
  moderationReasonCode: string | null
  moderationNote: string | null
  content: string
  recipient: Recipient
  point: { latitude: number; longitude: number }
  precision: LocationPrecision
  locality: string | null
  country: string
  publishedAt: string
}

export function projectOwnMessage(row: {
  public_id: string
  version: number
  status: string
  moderation_reason_code: string | null
  moderation_note: string | null
  content: string
  recipient: string | null
  latitude: number
  longitude: number
  location_precision: string
  locality: string | null
  country: string
  published_at: string
}): OwnMessage {
  return {
    publicId: row.public_id,
    version: row.version,
    status: row.status as MessageStatus,
    moderationReasonCode: row.moderation_reason_code,
    moderationNote: row.moderation_note,
    content: row.content,
    recipient: row.recipient as Recipient,
    point: { latitude: row.latitude, longitude: row.longitude },
    precision: row.location_precision as LocationPrecision,
    locality: row.locality,
    country: row.country,
    publishedAt: row.published_at,
  }
}