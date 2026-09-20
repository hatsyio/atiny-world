import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

export type LocationSelection = {
  locality: string
  country: string
  countryCode: string
  point: { latitude: number; longitude: number }
  attribution: string
}

const TTL_MS = 5 * 60 * 1000

function signature(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url')
}

export function signLocationSelection(
  selection: LocationSelection,
  secret: string,
  now = new Date(),
): string {
  const encoded = Buffer.from(JSON.stringify({ selection, expiresAt: now.getTime() + TTL_MS })).toString('base64url')
  return `${encoded}.${signature(encoded, secret)}`
}

export function verifyLocationSelection(
  token: string,
  secret: string,
  now = new Date(),
): LocationSelection | null {
  const [encoded, received] = token.split('.')
  if (!encoded || !received) return null
  const expected = signature(encoded, secret)
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { selection: LocationSelection; expiresAt: number }
    return value.expiresAt > now.getTime() ? value.selection : null
  } catch {
    return null
  }
}
