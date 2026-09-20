import { describe, expect, it } from 'vitest'

import {
  approximatePublicPoint,
  validatePublicLocation,
} from '../../../../src/domain/location/public-point'

describe('validatePublicLocation', () => {
  it('accepts valid coordinates with approximate precision by default', () => {
    expect(validatePublicLocation({ latitude: 37.5665, longitude: 126.978 })).toEqual({
      ok: true,
      data: { latitude: 37.5665, longitude: 126.978, precision: 'approximate' },
    })
  })

  it('requires an explicit precise confirmation and rejects out-of-range coordinates', () => {
    expect(validatePublicLocation({ latitude: 91, longitude: 0 })).toMatchObject({ ok: false })
    expect(validatePublicLocation({ latitude: 0, longitude: 181 })).toMatchObject({ ok: false })
    expect(validatePublicLocation({ latitude: 37.5665, longitude: 126.978, precision: 'precise' })).toMatchObject({ ok: false })
    expect(validatePublicLocation({ latitude: 37.5665, longitude: 126.978, precision: 'precise', confirmed: true })).toMatchObject({ ok: true })
  })
})

describe('approximatePublicPoint', () => {
  it('derives a stable per-message offset from a public locality center', () => {
    const center = { latitude: 37.5665, longitude: 126.978 }
    expect(approximatePublicPoint(center, '11111111-1111-4111-8111-111111111111')).toEqual(
      approximatePublicPoint(center, '11111111-1111-4111-8111-111111111111'),
    )
    expect(approximatePublicPoint(center, '11111111-1111-4111-8111-111111111111')).not.toEqual(center)
  })
})
