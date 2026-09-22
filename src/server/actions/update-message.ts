import type { Sql } from 'postgres'

import { errorResult, okResult, parsePublicId, type ActionResult } from '@/domain/contracts'
import { authorizeProfile } from '@/server/auth/authorize'
import {
  getSessionIdentity,
  readProfileByClerkUserId,
  type ProfileReader,
  type SessionIdentity,
} from '@/server/auth/session'
import { getLocationSelectionSecret } from '@/server/env'
import { verifyLocationSelectionResult } from '@/server/locations/selection-token'
import { updateMessage, type UpdateMessageInput } from '@/server/messages/update-message'
import type { CreateMessageLocationInput } from './create-message'
import { validateActionContent } from './content'
import {
  resolveLocationSelection,
  type ResolvedPublicLocation,
  type SelectionVerifier,
} from './location-input'

export type { SelectionVerifier } from './location-input'

export type UpdateMessageLocationInput = CreateMessageLocationInput

export type UpdateMessageActionInput = {
  publicId: string
  expectedVersion: number
  content: string
  location?: UpdateMessageLocationInput
}

export type UpdateMessageForSessionSuccess = {
  publicId: string
  version: number
  status: 'pending'
}

export type MessageUpdater = (
  input: UpdateMessageInput,
) => Promise<ActionResult<UpdateMessageForSessionSuccess>>

export type UpdateMessageForSessionDependencies = {
  readAuth?: () => Promise<SessionIdentity | null>
  readProfile?: ProfileReader
  verifySelection?: SelectionVerifier
  update?: MessageUpdater
}

export async function updateMessageForSession(
  sql: Sql,
  input: UpdateMessageActionInput,
  dependencies: UpdateMessageForSessionDependencies = {},
): Promise<ActionResult<UpdateMessageForSessionSuccess>> {
  const readAuth = dependencies.readAuth ?? getSessionIdentity
  const readProfile = dependencies.readProfile ?? readProfileByClerkUserId
  const verifySelection = dependencies.verifySelection ?? ((token: string) =>
    verifyLocationSelectionResult(token, getLocationSelectionSecret()))
  const update = dependencies.update ?? ((input: UpdateMessageInput) => updateMessage(sql, input))

  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const auth = await authorizeProfile(sql, identity, readProfile)
  if (!auth.ok) return auth

  const rawPublicId = input?.publicId
  const publicId = parsePublicId(rawPublicId ?? '')
  if (!publicId.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { publicId: 'message.publicId.invalid' },
    })
  }

  const expectedVersion = input?.expectedVersion
  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { expectedVersion: 'message.expectedVersion.invalid' },
    })
  }

  const content = validateActionContent(input?.content)
  if (!content.ok) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: content.fieldErrors,
    })
  }

  let location: ResolvedPublicLocation | undefined
  if (input?.location !== undefined) {
    const resolved = resolveLocationSelection(input.location, verifySelection)
    if (!resolved.ok) return resolved
    location = resolved.data
  }

  const updated = await update({
    clerkUserId: identity.clerkUserId,
    publicId: publicId.value,
    expectedVersion,
    content: content.value,
    ...(location !== undefined ? { location } : {}),
  })
  if (!updated.ok) return updated

  return okResult({ publicId: updated.data.publicId, version: updated.data.version, status: updated.data.status })
}