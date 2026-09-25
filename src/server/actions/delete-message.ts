import type { Sql } from 'postgres'

import { errorResult, okResult, parsePublicId, type ActionResult } from '@/domain/contracts'
import { getSessionIdentity, type SessionIdentity } from '@/server/auth/session'
import { deleteMessage, type DeleteMessageInput } from '@/server/messages/delete-message'

export type DeleteMessageActionInput = {
  publicId: string
  expectedVersion: number
  confirmation: true
}

export type DeleteMessageForSessionSuccess = {
  deleted: true
}

export type MessageDeleter = (
  input: DeleteMessageInput,
) => Promise<ActionResult<DeleteMessageForSessionSuccess>>

export type DeleteMessageForSessionDependencies = {
  readAuth?: () => Promise<SessionIdentity | null>
  delete?: MessageDeleter
}

// La cuenta suspendida puede borrar, así que la capa de sesión solo exige
// autenticación y deja el estado del perfil a la transacción que lo bloquea.
export async function deleteMessageForSession(
  sql: Sql,
  input: DeleteMessageActionInput,
  dependencies: DeleteMessageForSessionDependencies = {},
): Promise<ActionResult<DeleteMessageForSessionSuccess>> {
  const readAuth = dependencies.readAuth ?? getSessionIdentity
  const deleter = dependencies.delete ?? ((input: DeleteMessageInput) => deleteMessage(sql, input))

  const identity = await readAuth()
  if (!identity) return errorResult('NOT_FOUND', { messageKey: 'auth.unauthenticated' })

  const publicId = parsePublicId(input?.publicId ?? '')
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

  if (input?.confirmation !== true) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { confirmation: 'message.confirmation.required' },
    })
  }

  const deleted = await deleter({
    clerkUserId: identity.clerkUserId,
    publicId: publicId.value,
    expectedVersion,
    confirmation: input.confirmation,
  })
  if (!deleted.ok) return deleted

  return okResult({ deleted: true })
}