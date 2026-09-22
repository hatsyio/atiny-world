import type { Sql } from 'postgres'

import {
  errorResult,
  isRecipient,
  okResult,
  type ActionResult,
  type Recipient,
} from '@/domain/contracts'
import type { PublicPoint } from '@/domain/location/public-point'
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
import { validateActionContent } from './content'
import {
  resolveLocationSelection,
  type SelectionVerifier,
} from './location-input'

export type { SelectionVerifier } from './location-input'

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

  if (!isRecipient(input?.recipient)) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { recipient: 'message.recipient.invalid' },
    })
  }

  const content = validateActionContent(input?.content)
  if (!content.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: content.fieldErrors,
    })
  }

  const location = resolveLocationSelection(input?.location, verifySelection)
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
