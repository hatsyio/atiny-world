import { createHmac } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { signLocationSelection, verifyLocationSelectionResult } from '@/server/locations/selection-token'
import { signCursor, verifyCursor } from '@/server/messages/cursor'

const secret = 'test-secret'
const key = new TextEncoder().encode(secret)
const now = new Date('2026-10-07T12:00:00Z')
const selection = { locality: 'Seoul', country: 'Korea', countryCode: 'kr', point: { latitude: 37.5, longitude: 127 }, attribution: 'Geoapify' }
const expires = now.getTime() / 1000 + 300
const jwt = (payload: Record<string, unknown>, alg = 'HS256', typ = 'atiny-location-selection+jwt') => new SignJWT(payload).setProtectedHeader({ alg, typ }).sign(key)

describe('standard signed tokens', () => {
  it('issues a standard location JWT verifiable independently with HS256', async () => {
    const token = await signLocationSelection(selection, secret, now)
    const result = await jwtVerify(token, key, { algorithms: ['HS256'], currentDate: now })
    expect(result.protectedHeader.typ).toBe('atiny-location-selection+jwt')
    expect(result.payload).toMatchObject({ selection, exp: expires })
  })
  it('issues standard cursors and validates their payloads', async () => {
    vi.stubEnv('CURSOR_SECRET', secret)
    try {
      const payload = { id: '123', publishedAt: now.toISOString() }
      const token = await signCursor(payload)
      const result = await jwtVerify(token, key, { algorithms: ['HS256'] })
      expect(result.protectedHeader.typ).toBe('atiny-message-cursor+jwt')
      expect(await verifyCursor(token)).toEqual(payload)
      const invalid = await jwt({ id: 'not-a-database-id' }, 'HS256', 'atiny-message-cursor+jwt')
      expect(await verifyCursor(invalid)).toBeNull()
    } finally { vi.unstubAllEnvs() }
  })
  it.each(['HS384', 'HS512'])('rejects signed selections using %s', async alg => {
    const token = await jwt({ selection, exp: expires }, alg)
    expect(await verifyLocationSelectionResult(token, secret, now)).toEqual({ ok: false, reason: 'INVALID' })
  })
  it.each([
    { selection },
    { selection, exp: 'not-a-date' },
    { selection: { ...selection, point: { latitude: 100, longitude: 0 } }, exp: expires },
    { selection: {}, exp: expires - 600 },
  ])('rejects malformed signed payloads, including expired malformed payloads', async payload => {
    expect(await verifyLocationSelectionResult(await jwt(payload), secret, now)).toEqual({ ok: false, reason: 'INVALID' })
  })
  it('expires at five minutes and rejects wrong keys, token purposes and extra segments', async () => {
    const token = await signLocationSelection(selection, secret, now)
    expect(await verifyLocationSelectionResult(token, secret, new Date(now.getTime() + 300000))).toEqual({ ok: false, reason: 'EXPIRED' })
    expect(await verifyLocationSelectionResult(token, 'wrong-secret', now)).toEqual({ ok: false, reason: 'INVALID' })
    expect(await verifyLocationSelectionResult(`${token}.extra`, secret, now)).toEqual({ ok: false, reason: 'INVALID' })
    expect(await verifyLocationSelectionResult(await jwt({ selection, exp: expires }, 'HS256', 'atiny-message-cursor+jwt'), secret, now)).toEqual({ ok: false, reason: 'INVALID' })
  })
})

const legacyToken = (payload: unknown) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

it('requires a fresh selection and pagination after retiring the legacy format', async () => {
  vi.stubEnv('CURSOR_SECRET', secret)
  try {
    expect(await verifyLocationSelectionResult(legacyToken({ selection, expiresAt: now.getTime() + 300000 }), secret, now)).toEqual({ ok: false, reason: 'INVALID' })
    expect(await verifyCursor(legacyToken({ id: '123', publishedAt: now.toISOString() }))).toBeNull()
  } finally { vi.unstubAllEnvs() }
})

it.each([
  { id: '0' }, { id: '-1' }, { id: '9223372036854775808' },
  { id: '1', publishedAt: 'not-a-date' }, {},
])('rejects malformed authenticated cursor payloads', async payload => {
  vi.stubEnv('CURSOR_SECRET', secret)
  try {
    expect(await verifyCursor(await jwt(payload, 'HS256', 'atiny-message-cursor+jwt'))).toBeNull()
  } finally { vi.unstubAllEnvs() }
})

it('rejects other algorithms and purposes for cursors', async () => {
  vi.stubEnv('CURSOR_SECRET', secret)
  try {
    expect(await verifyCursor(await jwt({ id: '1' }, 'HS384', 'atiny-message-cursor+jwt'))).toBeNull()
    expect(await verifyCursor(await signLocationSelection(selection, secret))).toBeNull()
  } finally { vi.unstubAllEnvs() }
})
