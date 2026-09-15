import { describe, expect, it } from 'vitest'

import {
  createLogger,
  isLogSafeValue,
  LogRedactionError,
  redactLogFields,
  type LogFields,
  type LogLevel,
} from '../../../../src/server/observability/logger'

describe('redactLogFields', () => {
  it('redacts reserved keys regardless of value', () => {
    const redacted = redactLogFields({
      messageText: 'hola ATINY',
      content: 'cualquier texto',
      evidence: 'snapshot',
      apiKey: 'abc',
      kept: 'safe',
    })

    expect(redacted).toEqual({
      messageText: '[REDACTED]',
      content: '[REDACTED]',
      evidence: '[REDACTED]',
      apiKey: '[REDACTED]',
      kept: 'safe',
    })
  })

  it('redacts email-like and secret-like values even under safe keys', () => {
    const redacted = redactLogFields({
      detail: 'admin+atiny@example.com',
      trace: 'Bearer token-abc',
    })

    expect(redacted.detail).toBe('[REDACTED]')
    expect(redacted.trace).toBe('[REDACTED]')
  })

  it('redacts nested sensitive values without touching the rest of the object', () => {
    const redacted = redactLogFields({
      operation: {
        profileId: '42',
        email: 'a@b.com',
        nested: { address: 'Carrer Falsa 123' },
      },
    })

    expect(redacted).toEqual({
      operation: {
        profileId: '42',
        email: '[REDACTED]',
        nested: { address: '[REDACTED]' },
      },
    })
  })

  it('throws when asserting a reserved key', () => {
    expect(() => redactLogFields({ email: 'a@b.com' }, true)).toThrow(
      LogRedactionError,
    )
  })
})

describe('isLogSafeValue', () => {
  it('accepts benign strings, numbers and null', () => {
    expect(isLogSafeValue('hello')).toBe(true)
    expect(isLogSafeValue(42)).toBe(true)
    expect(isLogSafeValue(null)).toBe(true)
  })

  it('rejects emails and credential-like strings', () => {
    expect(isLogSafeValue('fan@example.org')).toBe(false)
    expect(isLogSafeValue('sk_live_0000')).toBe(false)
    expect(isLogSafeValue('eyJhbGciOiJIUzI1NiJ9')).toBe(false)
  })
})

describe('createLogger', () => {
  function recorded() {
    const lines: Array<{ level: LogLevel; scope: string; message: string; fields: LogFields }> = []
    const sink = (
      level: LogLevel,
      scope: string,
      message: string,
      fields: LogFields,
    ) => lines.push({ level, scope, message, fields })
    return { lines, sink }
  }

  it('emits structured records through the injected sink', () => {
    const { lines, sink } = recorded()
    const logger = createLogger('test', sink)

    logger.info('ready', { count: 3 })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ level: 'info', scope: 'test', message: 'ready' })
    expect(lines[0].fields.count).toBe(3)
  })

  it('redacts sensitive fields before they reach the sink', () => {
    const { lines, sink } = recorded()
    const logger = createLogger('test', sink)

    logger.error('failed', { email: 'fan@example.org', profileId: '42' })

    expect(lines[0].fields).toEqual({ email: '[REDACTED]', profileId: '42' })
  })

  it('supports warn and error levels', () => {
    const { lines, sink } = recorded()
    const logger = createLogger('test', sink)

    logger.warn('careful')
    logger.error('boom')

    expect(lines.map((line) => line.level)).toEqual(['warn', 'error'])
  })
})