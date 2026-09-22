import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { validatePublicLocation, type PublicPoint } from '@/domain/location/public-point'
import type { LocationSelectionVerification } from '@/server/locations/selection-token'

export type ResolvedPublicLocation = {
  precision: 'approximate' | 'precise'
  localityCenter: PublicPoint
  country: string
  countryCode: string
  confirmed?: boolean
}

export type SelectionVerifier = (token: string) => LocationSelectionVerification

const MAX_SELECTION_TOKEN_LENGTH = 4096

const SELECTION_REQUIRED = 'LOCATION_SELECTION_REQUIRED' as const
const SELECTION_INVALID = 'LOCATION_SELECTION_INVALID' as const
const SELECTION_EXPIRED = 'LOCATION_SELECTION_EXPIRED' as const

export function resolveLocationSelection(
  rawLocation: unknown,
  verifySelection: SelectionVerifier,
): ActionResult<ResolvedPublicLocation> {
  const location = rawLocation as Record<string, unknown> | null | undefined
  if (location === null || typeof location !== 'object') {
    return errorResult(SELECTION_REQUIRED, { messageKey: 'location.selection_required' })
  }
  const selectionId = location.selectionId
  if (typeof selectionId !== 'string' || selectionId.length === 0) {
    return errorResult(SELECTION_REQUIRED, { messageKey: 'location.selection_required' })
  }
  if (selectionId.length > MAX_SELECTION_TOKEN_LENGTH) {
    return errorResult(SELECTION_INVALID, { messageKey: 'location.selection_invalid' })
  }

  const verified = verifySelection(selectionId)
  if (!verified.ok) {
    return verified.reason === 'EXPIRED'
      ? errorResult(SELECTION_EXPIRED, { messageKey: 'location.selection_expired' })
      : errorResult(SELECTION_INVALID, { messageKey: 'location.selection_invalid' })
  }

  if (location.precision === 'approximate') {
    return okResult({
      precision: 'approximate',
      localityCenter: verified.selection.point,
      country: verified.selection.country,
      countryCode: verified.selection.countryCode,
    })
  }
  if (location.precision !== 'precise') {
    return errorResult(SELECTION_INVALID, { messageKey: 'location.selection_invalid' })
  }
  if (location.preciseLocationConfirmed !== true) {
    return errorResult(SELECTION_REQUIRED, { messageKey: 'location.selection_required' })
  }

  const point = validatePublicLocation({
    ...(location.confirmedPublicPoint as PublicPoint),
    precision: 'precise',
    confirmed: true,
  })
  if (!point.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { location: 'location.invalidPublicPoint' },
    })
  }

  return okResult({
    precision: 'precise',
    localityCenter: { latitude: point.data.latitude, longitude: point.data.longitude },
    confirmed: true,
    country: verified.selection.country,
    countryCode: verified.selection.countryCode,
  })
}