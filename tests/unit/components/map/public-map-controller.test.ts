import { describe, expect, it } from 'vitest'

import { createMapFeaturesGetHandler } from '../../../../src/app/api/map/features/route'
import {
  buildFeatureRequest,
  buildMessageRequest,
} from '../../../../src/components/map/public-map-controller'

describe('buildFeatureRequest', () => {
  it('requests only the active viewport and validated public filters', () => {
    expect(
      buildFeatureRequest(
        { west: -4, south: 40, east: -3, north: 41 },
        { city: 'Madrid', country: 'es' },
      ),
    ).toBe(
      '/api/map/features?west=-4&south=40&east=-3&north=41&city=Madrid&country=es',
    )
  })

  it('accepts the initial wide viewport without a validation error', async () => {
    const bounds = { west: -253.125, south: -55, east: 253.125, north: 73 }
    const url = buildFeatureRequest(bounds, { city: '', country: '' })
    const handler = createMapFeaturesGetHandler({
      list: async () => [],
      getDatabase: () => ({} as never),
    })

    expect(url).toBe('/api/map/features?west=-180&south=-55&east=180&north=73')
    expect((await handler(new Request(new URL(url, 'http://localhost').toString()))).status).toBe(200)
  })

  it('preserves an antimeridian crossing when the viewport extends west of -180', () => {
    expect(buildFeatureRequest(
      { west: -200, south: -10, east: -100, north: 10 },
      { city: '', country: '' },
    )).toBe('/api/map/features?west=160&south=-10&east=-100&north=10')
  })

  it('preserves an antimeridian crossing when the viewport extends east of 180', () => {
    expect(buildFeatureRequest(
      { west: 170, south: -10, east: 190, north: 10 },
      { city: '', country: '' },
    )).toBe('/api/map/features?west=170&south=-10&east=-170&north=10')
  })
})

describe('buildMessageRequest', () => {
  it('keeps the group traversal bounded to one page', () => {
    expect(
      buildMessageRequest(
        { west: -4, south: 40, east: -3, north: 41 },
        { city: '', country: '' },
      ),
    ).toBe('/api/map/messages?west=-4&south=40&east=-3&north=41&limit=20')
  })

  it('uses valid world bounds for group traversal in a wide viewport', () => {
    expect(buildMessageRequest(
      { west: -253.125, south: -55, east: 253.125, north: 73 },
      { city: '', country: '' },
    )).toBe('/api/map/messages?west=-180&south=-55&east=180&north=73&limit=20')
  })
})
