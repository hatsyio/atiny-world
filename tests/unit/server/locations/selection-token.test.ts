import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { signLocationSelection, verifyLocationSelection } from '../../../../src/server/locations/selection-token'

const payload = { locality: 'Seoul', country: 'South Korea', countryCode: 'kr', point: { latitude: 37.5665, longitude: 126.978 }, attribution: 'Geoapify' }

describe('location selection token', () => {
  it('signs only public normalized location data and expires it', () => {
    const token = signLocationSelection(payload, 'test-secret', new Date('2026-09-15T10:00:00Z'))
    expect(token).not.toContain('Gangnam')
    expect(verifyLocationSelection(token, 'test-secret', new Date('2026-09-15T10:04:00Z'))).toEqual(payload)
    expect(verifyLocationSelection(token, 'test-secret', new Date('2026-09-15T10:06:00Z'))).toBeNull()
  })
})
