export type PublicPoint = { latitude: number; longitude: number }
export type LocationPrecision = 'approximate' | 'precise'

export type PublicLocationInput = PublicPoint & {
  precision?: LocationPrecision
  confirmed?: boolean
}

export type PublicLocationValidation =
  | { ok: true; data: PublicPoint & { precision: LocationPrecision } }
  | { ok: false; code: 'VALIDATION_ERROR' }

export function validatePublicLocation(input: PublicLocationInput): PublicLocationValidation {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)
    || input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    return { ok: false, code: 'VALIDATION_ERROR' }
  }
  const precision = input.precision ?? 'approximate'
  if (precision === 'precise' && input.confirmed !== true) {
    return { ok: false, code: 'VALIDATION_ERROR' }
  }
  return { ok: true, data: { latitude: input.latitude, longitude: input.longitude, precision } }
}

function hash(value: string): number {
  let result = 2166136261
  for (const character of value) {
    result ^= character.charCodeAt(0)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function approximatePublicPoint(center: PublicPoint, messagePublicId: string): PublicPoint {
  const value = hash(messagePublicId)
  const angle = (value % 360) * (Math.PI / 180)
  const distance = 0.008 + ((value >>> 9) % 1000) / 250000
  return {
    latitude: Math.max(-90, Math.min(90, center.latitude + Math.cos(angle) * distance)),
    longitude: Math.max(-180, Math.min(180, center.longitude + Math.sin(angle) * distance)),
  }
}
