import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'

let processCursorKey: Uint8Array | undefined
const TOKEN_TYPE = 'atiny-message-cursor+jwt'
const cursorPayloadSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,18}$/).refine(id => id.length < 19 || id <= '9223372036854775807'),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
})
export type CursorPayload = z.infer<typeof cursorPayloadSchema>

function cursorKey(): Uint8Array {
  const configured = process.env.CURSOR_SECRET
  if (configured) return new TextEncoder().encode(configured)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CURSOR_SECRET is required in production')
  }
  if (!processCursorKey) processCursorKey = randomBytes(32)
  return processCursorKey
}

export async function signCursor(payload: CursorPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: TOKEN_TYPE })
    .sign(cursorKey())
}

export async function verifyCursor(cursor: string): Promise<CursorPayload | null> {
  const key = cursorKey()
  try {
    const { payload } = await jwtVerify(cursor, key, { algorithms: ['HS256'], typ: TOKEN_TYPE })
    const parsed = cursorPayloadSchema.safeParse(payload)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
