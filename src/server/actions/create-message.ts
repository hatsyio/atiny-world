import type { Sql } from 'postgres'

import {
  errorResult,
  okResult,
  type ActionResult,
} from '@/domain/contracts'
import type { LocationSelectionInput } from '@/domain/location/selection'
import { authorizeProfile } from '@/server/auth/authorize'
import {
  getSessionIdentity,
  readProfileByClerkUserId,
  type ProfileReader,
  type SessionIdentity,
} from '@/server/auth/session'
import { getLocationSelectionSecret } from '@/server/env'
import { verifyLocationSelectionResult } from '@/server/locations/selection-token'
import { createMessage, type CreateMessageInput } from '@/server/messages/create-message'
import { captureServerEvent } from '@/server/observability/posthog'
import { validateActionContent } from './content'
import {
  resolveLocationSelection,
  type SelectionVerifier,
} from './location-input'

export type { SelectionVerifier } from './location-input'

export type CreateMessageLocationInput = LocationSelectionInput

export type CreateMessageActionInput = {
  content: string
  location: CreateMessageLocationInput
}

export type CreateMessageForSessionSuccess = {
  publicId: string
  version: 1
  status: 'pending'
  publicVisible: boolean
}

export type MessagePublisher = (
  input: CreateMessageInput,
) => Promise<ActionResult<{ publicId: string; status: 'pending'; publicVisible: boolean }>>

export type CreateMessageForSessionDependencies = {
  readAuth?: () => Promise<SessionIdentity | null>
  readProfile?: ProfileReader
  verifySelection?: SelectionVerifier
  publish?: MessagePublisher
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

  const content = validateActionContent(input?.content)
  if (!content.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: content.fieldErrors,
    })
  }

  const location = await resolveLocationSelection(input?.location, verifySelection)
  if (!location.ok) return location

  const created = await publish({
    clerkUserId: identity.clerkUserId,
    content: content.value,
    location: location.data,
  })
  if (!created.ok) return created

  await captureServerEvent(identity.clerkUserId, 'message_published', {
    location_precision: input.location.precision,
    public_visible: created.data.publicVisible,
  })

  return okResult({ publicId: created.data.publicId, version: 1, status: created.data.status, publicVisible: created.data.publicVisible })
}
