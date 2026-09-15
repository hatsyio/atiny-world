// Mapeo aislado de problemas de dominio a su forma HTTP/JSON traducible. El
// ordenador de ruta (y los tests) solo ven esta forma: nada de `retryable`,
// detalles internos ni texto libre. El envelope conserva únicamente campos
// estables y traducibles (`messageKey`) más detalles opcionales de error.

import type { Problem } from '../../domain/contracts'

export interface HttpProblem {
  code: Problem['code']
  messageKey: string
  fieldErrors?: Record<string, string>
  retryAfterSeconds?: number
}

export function toHttpProblem(problem: Problem): HttpProblem {
  const http: HttpProblem = {
    code: problem.code,
    messageKey: problem.messageKey,
  }
  if (problem.fieldErrors !== undefined) http.fieldErrors = problem.fieldErrors
  if (problem.retryAfterSeconds !== undefined) {
    http.retryAfterSeconds = problem.retryAfterSeconds
  }
  return http
}
