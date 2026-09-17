import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  parseJsonBody,
  zodFieldErrors,
} from '../../../../src/server/http/validation'
import { runAction } from '../../../../src/server/actions/result'

const payloadSchema = z.strictObject({
  content: z.string().min(1).max(500),
  recipient: z.enum(['ateez', 'atiny']).nullable(),
})

describe('parseJsonBody', () => {
  function request(body: string): Request {
    const url = 'http://localhost/api/test'
    return new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
  }

  it('accepts a valid payload and rejects unknown fields', async () => {
    const result = await parseJsonBody(
      request(JSON.stringify({ content: 'a', recipient: 'atiny', sneaky: true })),
      payloadSchema,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.fieldErrors).toBeDefined()
  })

  it('applies the schema strictly with only allowed fields', async () => {
    const result = await parseJsonBody(
      request(JSON.stringify({ content: 'hola', recipient: 'ateez' })),
      payloadSchema,
    )

    expect(result).toEqual({
      ok: true,
      data: { content: 'hola', recipient: 'ateez' },
    })
  })

  it('rejects malformed JSON without leaking internals', async () => {
    const result = await parseJsonBody(request('not-json'), payloadSchema)

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects bodies larger than the configured limit', async () => {
    const big = JSON.stringify({ content: 'x'.repeat(2000), recipient: null })
    const result = await parseJsonBody(
      request(big),
      payloadSchema,
      64,
    )

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })
})

describe('zodFieldErrors', () => {
  it('flattens nested issues into dot-paths with first message per field', () => {
    const error = payloadSchema.safeParse({}).error

    expect(error).toBeDefined()
    if (error) {
      const fieldErrors = zodFieldErrors(error)

      expect(fieldErrors.content).toBeDefined()
      expect(fieldErrors.recipient).toBeDefined()
    }
  })
})

describe('runAction', () => {
  it('returns the action result on success', async () => {
    const result = await runAction(async () => ({
      ok: true as const,
      data: { done: true },
    }))

    expect(result).toEqual({ ok: true, data: { done: true } })
  })

  it('maps thrown errors to a stable INTERNAL_ERROR', async () => {
    const result = await runAction(async () => {
      throw new Error('boom')
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
  })
})