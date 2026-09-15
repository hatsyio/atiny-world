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
})
