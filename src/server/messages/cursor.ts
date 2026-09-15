import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

let processCursorKey: Buffer | undefined

function cursorKey(): Buffer {
  const configured = process.env.CURSOR_SECRET
  if (configured) return Buffer.from(configured, 'utf8')
  if (!processCursorKey) processCursorKey = randomBytes(32)
  return processCursorKey
}

export interface CursorPayload {
  id: string
  publishedAt?: string
}

export function signCursor(payload: CursorPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${hmac(body)}`
}

export function verifyCursor(cursor: string): CursorPayload | null {
  const [body, signature] = cursor.split('.')
  if (!body || !signature) return null

  const expected = hmac(body)
  const left = Buffer.from(signature, 'utf8')
  const right = Buffer.from(expected, 'utf8')

  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as CursorPayload

    if (typeof payload.id !== 'string' || payload.id.length === 0) return null
    if (
      payload.publishedAt !== undefined &&
      typeof payload.publishedAt !== 'string'
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function hmac(body: string): string {
  return createHmac('sha256', cursorKey()).update(body).digest('base64url')
}