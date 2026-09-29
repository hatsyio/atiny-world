import { describe, expect, it } from 'vitest'

import { parseMapQuery } from '../../../../src/server/http/map-params'

describe('parseMapQuery', () => {
  it('preserves validated city and country filters', () => {
    const parsed = parseMapQuery(
      new URLSearchParams({
        west: '-4',
        south: '40',
        east: '-3',
        north: '41',
        city: ' Madrid ',
        country: 'ES',
      }),
    )

    expect(parsed).toEqual({
      ok: true,
      data: expect.objectContaining({ city: 'Madrid', country: 'es' }),
    })
  })

  it('rejects the removed recipient filter', () => {
    const parsed = parseMapQuery(
      new URLSearchParams({
        west: '-4',
        south: '40',
        east: '-3',
        north: '41',
        recipient: 'ateez',
      }),
    )

    expect(parsed).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects the removed author filter', () => {
    const parsed = parseMapQuery(
      new URLSearchParams({
        west: '-4',
        south: '40',
        east: '-3',
        north: '41',
        fan: '00000000-0000-4000-8000-000000000001',
      }),
    )

    expect(parsed).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })
})
