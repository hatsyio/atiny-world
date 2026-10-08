import 'server-only'

import { SignJWT, jwtVerify, errors } from 'jose'
import { z } from 'zod'
import { locationSelectionSchema, type LocationSelection } from '@/domain/location/selection'

export type { LocationSelection } from '@/domain/location/selection'

const tokenPayloadSchema = z.object({
  selection: locationSelectionSchema,
  exp: z.number().int().nonnegative(),
})
const TOKEN_TYPE = 'atiny-location-selection+jwt'
const TTL_SECONDS = 5 * 60

export async function signLocationSelection(
  selection: LocationSelection,
  secret: string,
  now = new Date(),
): Promise<string> {
  return new SignJWT({ selection })
    .setProtectedHeader({ alg: 'HS256', typ: TOKEN_TYPE })
    .setExpirationTime(Math.floor(now.getTime() / 1000) + TTL_SECONDS)
    .sign(new TextEncoder().encode(secret))
}

export type LocationSelectionVerification =
  | { ok: true; selection: LocationSelection }
  | { ok: false; reason: 'INVALID' | 'EXPIRED' }

export async function verifyLocationSelectionResult(
  token: string,
  secret: string,
  now = new Date(),
): Promise<LocationSelectionVerification> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'], typ: TOKEN_TYPE, requiredClaims: ['exp'], currentDate: now,
    })
    const parsed = tokenPayloadSchema.safeParse(payload)
    return parsed.success
      ? { ok: true, selection: parsed.data.selection }
      : { ok: false, reason: 'INVALID' }
  } catch (error) {
    // jose checks the signature before claims. A malformed authenticated payload
    // is still INVALID even when its expiration claim is in the past.
    if (error instanceof errors.JWTExpired && tokenPayloadSchema.safeParse(error.payload).success) {
      return { ok: false, reason: 'EXPIRED' }
    }
    return { ok: false, reason: 'INVALID' }
  }
}
