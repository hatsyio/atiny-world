import { createHmac } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  signLocationSelection,
  verifyLocationSelection,
  verifyLocationSelectionResult,
} from '../../../../src/server/locations/selection-token'

const payload = { locality: 'Seoul', country: 'South Korea', countryCode: 'kr', point: { latitude: 37.5665, longitude: 126.978 }, attribution: 'Geoapify' }

describe('location selection token', () => {
  it('signs only public normalized location data and expires it', () => {
    const token = signLocationSelection(payload, 'test-secret', new Date('2026-09-15T10:00:00Z'))
    expect(token).not.toContain('Gangnam')
    expect(verifyLocationSelection(token, 'test-secret', new Date('2026-09-15T10:04:00Z'))).toEqual(payload)
    expect(verifyLocationSelection(token, 'test-secret', new Date('2026-09-15T10:06:00Z'))).toBeNull()
  })

  it('distinguishes tampered tokens from expired ones', () => {
    const token = signLocationSelection(payload, 'test-secret', new Date('2026-09-15T10:00:00Z'))

    expect(verifyLocationSelectionResult('', 'test-secret')).toEqual({ ok: false, reason: 'INVALID' })
    expect(verifyLocationSelectionResult(`${token}x`, 'test-secret', new Date('2026-09-15T10:04:00Z'))).toEqual({
      ok: false,
      reason: 'INVALID',
    })
    expect(verifyLocationSelectionResult(token, 'test-secret', new Date('2026-09-15T10:06:00Z'))).toEqual({
      ok: false,
      reason: 'EXPIRED',
    })
    expect(verifyLocationSelectionResult(token, 'test-secret', new Date('2026-09-15T10:04:00Z'))).toEqual({
      ok: true,
      selection: payload,
    })
  })
})

// Signed malformed payloads must fail before their expiry or selection is consumed.
it.each(['extra', 'unicode', 'missing-expiry', 'invalid-point'])('rejects malformed %s tokens without throwing', kind => {
  const now = new Date('2026-09-15T10:00:00Z')
  const token = signLocationSelection(payload, 'test-secret', now)
  let malformed = `${token}.extra`
  if (kind === 'unicode') malformed = `${token.split('.')[0]}.${'é'.repeat(43)}`
  if (kind === 'missing-expiry' || kind === 'invalid-point') {
    const value = kind === 'missing-expiry' ? { selection: payload } : { selection: { ...payload, point: { latitude: 100, longitude: 0 } }, expiresAt: now.getTime() + 1000 }
    const encoded = Buffer.from(JSON.stringify(value)).toString('base64url')
    malformed = `${encoded}.${createHmac('sha256', 'test-secret').update(encoded).digest('base64url')}`
  }
  expect(verifyLocationSelectionResult(malformed, 'test-secret', now)).toEqual({ ok: false, reason: 'INVALID' })
})
