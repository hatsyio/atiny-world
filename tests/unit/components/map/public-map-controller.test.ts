import { describe, expect, it } from 'vitest'

import {
  buildFeatureRequest,
  buildMessageRequest,
} from '../../../../src/components/map/public-map-controller'

describe('buildFeatureRequest', () => {
  it('requests only the active viewport and validated public filters', () => {
    expect(
      buildFeatureRequest(
        { west: -4, south: 40, east: -3, north: 41 },
        { city: 'Madrid', country: 'es', recipient: 'atiny', fan: '' },
      ),
    ).toBe(
      '/api/map/features?west=-4&south=40&east=-3&north=41&city=Madrid&country=es&recipient=atiny',
    )
  })
})

describe('buildMessageRequest', () => {
  it('keeps the group traversal bounded to one page', () => {
    expect(
      buildMessageRequest(
        { west: -4, south: 40, east: -3, north: 41 },
        { city: '', country: '', recipient: '', fan: '' },
      ),
    ).toBe('/api/map/messages?west=-4&south=40&east=-3&north=41&limit=20')
  })
})
