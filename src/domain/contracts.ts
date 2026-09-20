// Clasificación canónica de valores de dominio. Cada guarda aplica EXACTAMENTE
// las reglas de data-model.md; cualquier cambio futuro de vocabulario (estados,
// roles, destinatarios, códigos) se declara aquí una sola vez y los tests de
// contrato lo fijan.

export const RECIPIENTS = [
  'ateez',
  'hongjoong',
  'seonghwa',
  'yunho',
  'yeosang',
  'san',
  'mingi',
  'wooyoung',
  'jongho',
  'atiny',
] as const

export type Recipient = (typeof RECIPIENTS)[number] | null

export function isRecipient(value: unknown): value is Recipient {
  return value === null || (typeof value === 'string' && (RECIPIENTS as readonly string[]).includes(value))
}

export const MESSAGE_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const

export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === 'string' && (MESSAGE_STATUSES as readonly string[]).includes(value)
}

export const LOCATION_PRECISIONS = ['approximate', 'precise'] as const

export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number]

export function isLocationPrecision(value: unknown): value is LocationPrecision {
  return (
    typeof value === 'string' && (LOCATION_PRECISIONS as readonly string[]).includes(value)
  )
}

export const ACCOUNT_STATES = ['active', 'deletion_pending'] as const

export type AccountState = (typeof ACCOUNT_STATES)[number]

export function isAccountState(value: unknown): value is AccountState {
  return typeof value === 'string' && (ACCOUNT_STATES as readonly string[]).includes(value)
}

export const PROFILE_ROLES = ['fan', 'admin', 'owner'] as const

export type ProfileRole = (typeof PROFILE_ROLES)[number]

export function isProfileRole(value: unknown): value is ProfileRole {
  return typeof value === 'string' && (PROFILE_ROLES as readonly string[]).includes(value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parsePublicId(value: string): { ok: true; value: string } | { ok: false } {
  if (!UUID_PATTERN.test(value)) return { ok: false }
  return { ok: true, value: value.toLowerCase() }
}

export function parseCursor(value: string, maxLength: number): { ok: true; value: string } | { ok: false } {
  if (value.length === 0 || value.length > maxLength) return { ok: false }
  return { ok: true, value }
}

export type ProblemCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'MESSAGE_LIMIT_REACHED'
  | 'MESSAGE_COOLDOWN_ACTIVE'
  | 'PROFILE_INCOMPLETE'
  | 'ACCOUNT_SUSPENDED'
  | 'LOCATION_SELECTION_REQUIRED'
  | 'LOCATION_SELECTION_EXPIRED'
  | 'LOCATION_SELECTION_INVALID'
  | 'LOCATION_PROVIDER_UNAVAILABLE'
  | 'MAP_DATA_UNAVAILABLE'
  | 'INTERNAL_ERROR'

const PROBLEM_CODES: readonly string[] = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'MESSAGE_LIMIT_REACHED',
  'MESSAGE_COOLDOWN_ACTIVE',
  'PROFILE_INCOMPLETE',
  'ACCOUNT_SUSPENDED',
  'LOCATION_SELECTION_REQUIRED',
  'LOCATION_SELECTION_EXPIRED',
  'LOCATION_SELECTION_INVALID',
  'LOCATION_PROVIDER_UNAVAILABLE',
  'MAP_DATA_UNAVAILABLE',
  'INTERNAL_ERROR',
]

export function isProblemCode(value: unknown): value is ProblemCode {
  return typeof value === 'string' && PROBLEM_CODES.includes(value)
}

// Únicamente los fallos de infraestructura transitoria se marcan retryable.
// Los límites de negocio (máximo de mensajes, periodo de enfriamiento, selección
// caducada) NO lo son: reintentarlos automáticamente ocultaría el motivo.
const RETRYABLE_CODES = new Set(['LOCATION_PROVIDER_UNAVAILABLE', 'MAP_DATA_UNAVAILABLE', 'INTERNAL_ERROR'])

export interface Problem {
  code: ProblemCode
  messageKey: string
  fieldErrors?: Record<string, string>
  retryAfterSeconds?: number
  retryable: boolean
}

export interface ProblemDetails {
  messageKey: string
  fieldErrors?: Record<string, string>
  retryAfterSeconds?: number
}

export function createProblem(code: ProblemCode, details: ProblemDetails): Problem {
  return {
    code,
    messageKey: details.messageKey,
    ...(details.fieldErrors !== undefined ? { fieldErrors: details.fieldErrors } : {}),
    ...(details.retryAfterSeconds !== undefined ? { retryAfterSeconds: details.retryAfterSeconds } : {}),
    retryable: RETRYABLE_CODES.has(code),
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ProblemEnvelope }

// Envelope serializable: TIP nunca expone `retryable` ni `retryAfterSeconds`
// cuando no se aporta, y el flag `retryable` (interno, para reenvíos del
// proveedor) jamás viaja en la respuesta.
export type ProblemEnvelope = {
  code: ProblemCode
  messageKey: string
  fieldErrors?: Record<string, string>
  retryAfterSeconds?: number
}

export function toProblemEnvelope(problem: Problem): ProblemEnvelope {
  return {
    code: problem.code,
    messageKey: problem.messageKey,
    ...('fieldErrors' in problem ? { fieldErrors: problem.fieldErrors } : {}),
    ...('retryAfterSeconds' in problem ? { retryAfterSeconds: problem.retryAfterSeconds } : {}),
  }
}

export function okResult<T>(data: T): Extract<ActionResult<T>, { ok: true }> {
  return { ok: true, data }
}

export function errorResult(
  code: ProblemCode,
  details: ProblemDetails,
): Extract<ActionResult<never>, { ok: false }> {
  return { ok: false, error: toProblemEnvelope(createProblem(code, details)) }
}
