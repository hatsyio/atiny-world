import type { Sql } from 'postgres'

import {
  errorResult,
  isRecipient,
  okResult,
  type ActionResult,
  type Recipient,
} from '@/domain/contracts'
import {
  validatePublicLocation,
  type PublicPoint,
} from '@/domain/location/public-point'
import { countGraphemes, MAX_GRAPHEMES } from '@/domain/messages/content'
import { authorizeProfile } from '@/server/auth/authorize'
import {
  getSessionIdentity,
  readProfileByClerkUserId,
  type ProfileReader,
  type SessionIdentity,
} from '@/server/auth/session'
import { getLocationSelectionSecret } from '@/server/env'
import {
  verifyLocationSelectionResult,
  type LocationSelectionVerification,
} from '@/server/locations/selection-token'
import { createMessage, type CreateMessageInput } from '@/server/messages/create-message'

export type CreateMessageLocationInput =
  | { selectionId: string; precision: 'approximate' }
  | {
      selectionId: string
      precision: 'precise'
      confirmedPublicPoint: PublicPoint
      preciseLocationConfirmed: true
    }

export type CreateMessageActionInput = {
  content: string
  recipient: Recipient
  location: CreateMessageLocationInput
}

export type CreateMessageForSessionSuccess = {
  publicId: string
  version: 1
  status: 'pending'
  publicVisible: boolean
}

export type SelectionVerifier = (
  token: string,
) => LocationSelectionVerification

export type MessagePublisher = (
  input: CreateMessageInput,
) => Promise<ActionResult<{ publicId: string; status: 'pending'; publicVisible: boolean }>>

export type CreateMessageForSessionDependencies = {
  readAuth?: () => Promise<SessionIdentity | null>
  readProfile?: ProfileReader
  verifySelection?: SelectionVerifier
  publish?: MessagePublisher
}

const MAX_SELECTION_TOKEN_LENGTH = 4096

const SELECTION_REQUIRED = 'LOCATION_SELECTION_REQUIRED' as const
const SELECTION_INVALID = 'LOCATION_SELECTION_INVALID' as const
const SELECTION_EXPIRED = 'LOCATION_SELECTION_EXPIRED' as const

function validateContent(
  content: unknown,
): { ok: true; value: string } | { ok: false; fieldErrors: Record<string, string> } {
  if (typeof content !== 'string' || content.length === 0) {
    return { ok: false, fieldErrors: { content: 'message.content.required' } }
  }
  if (countGraphemes(content) > MAX_GRAPHEMES) {
    return { ok: false, fieldErrors: { content: 'message.content.limitReached' } }
  }
  return { ok: true, value: content }
}

function resolvePublishLocation(
  input: CreateMessageActionInput,
  verifySelection: SelectionVerifier,
): ActionResult<CreateMessageInput['location']> {
  const rawLocation = input?.location
  if (rawLocation === null || typeof rawLocation !== 'object') {
    return errorResult(SELECTION_REQUIRED, { messageKey: 'location.selection_required' })
  }
  const location = rawLocation as Record<string, unknown>
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

export async function createMessageForSession(
  sql: Sql,
  input: CreateMessageActionInput,
  dependencies: CreateMessageForSessionDependencies = {},
): Promise<ActionResult<CreateMessageForSessionSuccess>> {
  const readAuth = dependencies.readAuth ?? getSessionIdentity
  const readProfile = dependencies.readProfile ?? readProfileByClerkUserId
  const verifySelection = dependencies.verifySelection ?? ((token: string) =>
    verifyLocationSelectionResult(token, getLocationSelectionSecret()))
  const publish = dependencies.publish ?? ((input: CreateMessageInput) => createMessage(sql, input))

  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const auth = await authorizeProfile(sql, identity, readProfile)
  if (!auth.ok) return auth

  if (!isRecipient(input?.recipient)) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { recipient: 'message.recipient.invalid' },
    })
  }

  const content = validateContent(input?.content)
  if (!content.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: content.fieldErrors,
    })
  }

  const location = resolvePublishLocation(input, verifySelection)
  if (!location.ok) return location

  const created = await publish({
    clerkUserId: identity.clerkUserId,
    content: content.value,
    recipient: input.recipient,
    location: location.data,
  })
  if (!created.ok) return created

  return okResult({ publicId: created.data.publicId, version: 1, status: created.data.status, publicVisible: created.data.publicVisible })
}
