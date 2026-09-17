import { describe, expect, it } from 'vitest'

import {
  isRecipient,
  isMessageStatus,
  isAccountState,
  isProfileRole,
  parsePublicId,
  parseCursor,
  createProblem,
  isProblemCode,
  okResult,
  errorResult,
} from '../../../src/domain/contracts'
import { toHttpProblem } from '../../../src/server/http/problem'

describe('recipient allowlist', () => {
  it('accepts the nine recipients and ATINY', () => {
    expect(
      ['ateez', 'hongjoong', 'seonghwa', 'yunho', 'yeosang', 'san', 'mingi', 'wooyoung', 'jongho', 'atiny'].every(
        isRecipient,
      ),
    ).toBe(true)
    expect(isRecipient(null)).toBe(true)
  })

  it('rejects unknown recipients', () => {
    expect(isRecipient('wooyoung2')).toBe(false)
    expect(isRecipient('another')).toBe(false)
  })
})

describe('message states and account states', () => {
  it('accepts the four message states', () => {
    for (const status of ['pending', 'approved', 'rejected', 'withdrawn']) {
      expect(isMessageStatus(status)).toBe(true)
    }
    expect(isMessageStatus('deleted')).toBe(false)
  })

  it('accepts account states and roles', () => {
    expect(isAccountState('active')).toBe(true)
    expect(isAccountState('deletion_pending')).toBe(true)
    expect(isAccountState('suspended')).toBe(false)

    expect(isProfileRole('fan')).toBe(true)
    expect(isProfileRole('admin')).toBe(true)
    expect(isProfileRole('owner')).toBe(true)
    expect(isProfileRole('moderator')).toBe(false)
  })
})

describe('UUID and cursor primitives', () => {
  it('parses well-formed public ids', () => {
    expect(parsePublicId('00000000-0000-4000-8000-000000000000')).toEqual({
      ok: true,
      value: '00000000-0000-4000-8000-000000000000',
    })
  })

  it('rejects non-UUID public ids', () => {
    expect(parsePublicId('not-a-uuid').ok).toBe(false)
    expect(parsePublicId('').ok).toBe(false)
  })

  it('parses and limits opaque cursors', () => {
    const cursor = 'a'.repeat(50)
    expect(parseCursor(cursor, 500).ok).toBe(true)
    expect(parseCursor('a'.repeat(501), 500).ok).toBe(false)
  })
})

describe('problem envelope', () => {
  it('builds a serializable problem', () => {
    const problem = createProblem('MESSAGE_LIMIT_REACHED', {
      messageKey: 'messages.limitReached',
      retryAfterSeconds: 30,
    })

    expect(problem).toMatchObject({
      code: 'MESSAGE_LIMIT_REACHED',
      messageKey: 'messages.limitReached',
      retryAfterSeconds: 30,
    })
    expect(problem.retryable).toBe(false)
  })

  it('recognizes stable problem codes', () => {
    expect(isProblemCode('MESSAGE_LIMIT_REACHED')).toBe(true)
    expect(isProblemCode('anything-else')).toBe(false)
  })
})

describe('action results', () => {
  it('wraps success data', () => {
    expect(okResult({ publicId: 'abc' })).toEqual({
      ok: true,
      data: { publicId: 'abc' },
    })
  })

  it('wraps stable failures', () => {
    expect(
      errorResult('MESSAGE_COOLDOWN_ACTIVE', {
        messageKey: 'messages.cooldownActive',
        retryAfterSeconds: 9,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'MESSAGE_COOLDOWN_ACTIVE',
        messageKey: 'messages.cooldownActive',
        retryAfterSeconds: 9,
      },
    })
  })
})

describe('http problem mapping', () => {
  it('maps a domain problem to an HTTP problem without extra fields', () => {
    const problem = createProblem('LOCATION_SELECTION_EXPIRED', {
      messageKey: 'location.selectionExpired',
    })
    const http = toHttpProblem(problem)

    expect(http).toEqual({
      code: 'LOCATION_SELECTION_EXPIRED',
      messageKey: 'location.selectionExpired',
    })
  })

  it('keeps optional error details when present', () => {
    const http = toHttpProblem(
      createProblem('VALIDATION_ERROR', {
        messageKey: 'validation.invalid',
        fieldErrors: { content: 'too long' },
      }),
    )

    expect(http).toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { content: 'too long' },
    })
  })
})