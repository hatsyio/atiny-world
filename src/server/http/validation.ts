import { z } from 'zod'

import { errorResult, okResult, type ActionResult } from '@/domain/contracts'

export const DEFAULT_MAX_BODY_BYTES = 16 * 1024

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'body'
    if (!(field in fieldErrors)) fieldErrors[field] = issue.message
  }

  return fieldErrors
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<ActionResult<T>> {
  const raw = await request.text()

  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return errorResult('VALIDATION_ERROR', { messageKey: 'validation.bodyTooLarge' })
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return errorResult('VALIDATION_ERROR', { messageKey: 'validation.invalidJson' })
  }

  const parsed = schema.safeParse(value)

  if (!parsed.success) {
    return errorResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: zodFieldErrors(parsed.error),
    })
  }

  return okResult(parsed.data)
}