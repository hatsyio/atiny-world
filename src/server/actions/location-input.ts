import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import type { PublicPoint } from '@/domain/location/public-point'
import { locationSelectionInputSchema, selectionIdSchema } from '@/domain/location/selection'
import { z } from 'zod'
import type { LocationSelectionVerification } from '@/server/locations/selection-token'

export type ResolvedPublicLocation = {
  precision: 'approximate' | 'precise'
  localityCenter: PublicPoint
  locality: string
  country: string
  countryCode: string
  confirmed?: boolean
}

export type SelectionVerifier = (token: string) => LocationSelectionVerification

const selectionEnvelopeSchema = z.object({ selectionId: selectionIdSchema })

const SELECTION_REQUIRED = 'LOCATION_SELECTION_REQUIRED' as const
const SELECTION_INVALID = 'LOCATION_SELECTION_INVALID' as const
const SELECTION_EXPIRED = 'LOCATION_SELECTION_EXPIRED' as const

export function resolveLocationSelection(
  rawLocation: unknown,
  verifySelection: SelectionVerifier,
): ActionResult<ResolvedPublicLocation> {
  const envelope = selectionEnvelopeSchema.safeParse(rawLocation)
  if (!envelope.success) {
    const tooLong = envelope.error.issues.some(issue => issue.code === 'too_big')
    return errorResult(tooLong ? SELECTION_INVALID : SELECTION_REQUIRED, {
      messageKey: tooLong ? 'location.selection_invalid' : 'location.selection_required',
    })
  }
  const selectionId = envelope.data.selectionId

  const verified = verifySelection(selectionId)
  if (!verified.ok) {
    return verified.reason === 'EXPIRED'
      ? errorResult(SELECTION_EXPIRED, { messageKey: 'location.selection_expired' })
      : errorResult(SELECTION_INVALID, { messageKey: 'location.selection_invalid' })
  }

  const parsed = locationSelectionInputSchema.safeParse(rawLocation)
  if (!parsed.success) {
    if (parsed.error.issues.some(issue => issue.path[0] === 'precision')) {
      return errorResult(SELECTION_INVALID, { messageKey: 'location.selection_invalid' })
    }
    if (parsed.error.issues.some(issue => issue.path[0] === 'preciseLocationConfirmed')) {
      return errorResult(SELECTION_REQUIRED, { messageKey: 'location.selection_required' })
    }
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { location: 'location.invalidPublicPoint' },
    })
  }
  const location = parsed.data
  if (location.precision === 'approximate') {
    return okResult({
      precision: 'approximate',
      localityCenter: verified.selection.point,
      locality: verified.selection.locality,
      country: verified.selection.country,
      countryCode: verified.selection.countryCode,
    })
  }

  return okResult({
    precision: 'precise',
    localityCenter: { latitude: location.confirmedPublicPoint.latitude, longitude: location.confirmedPublicPoint.longitude },
    confirmed: true,
    locality: verified.selection.locality,
    country: verified.selection.country,
    countryCode: verified.selection.countryCode,
  })
}
