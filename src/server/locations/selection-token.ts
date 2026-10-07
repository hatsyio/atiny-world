import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'
import { locationSelectionSchema, type LocationSelection } from '@/domain/location/selection'

export type { LocationSelection } from '@/domain/location/selection'

const tokenPayloadSchema = z.object({
  selection: locationSelectionSchema,
  expiresAt: z.number().int().nonnegative(),
})

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
  const result = verifyLocationSelectionResult(token, secret, now)
  return result.ok ? result.selection : null
}

export type LocationSelectionVerification =
  | { ok: true; selection: LocationSelection }
  | { ok: false; reason: 'INVALID' | 'EXPIRED' }

export function verifyLocationSelectionResult(
  token: string,
  secret: string,
  now = new Date(),
): LocationSelectionVerification {
  const parts = token.split('.')
  const [encoded, received] = parts
  if (parts.length !== 2 || !encoded || !received || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(received)) return { ok: false, reason: 'INVALID' }
  const expected = signature(encoded, secret)
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return { ok: false, reason: 'INVALID' }
  try {
    const parsed = tokenPayloadSchema.safeParse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')))
    if (!parsed.success) return { ok: false, reason: 'INVALID' }
    const value = parsed.data
    if (value.expiresAt <= now.getTime()) return { ok: false, reason: 'EXPIRED' }
    return { ok: true, selection: value.selection }
  } catch {
    return { ok: false, reason: 'INVALID' }
  }
}
