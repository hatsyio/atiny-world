import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { PublicMessageDetail } from '../../../../src/domain/messages/public-message'
import { enrichMissingLocalities } from '../../../../src/server/messages/latest-public-messages'

const baseMessage: PublicMessageDetail = {
  publicId: '11111111-1111-4111-8111-111111111111',
  point: { latitude: 40.4191, longitude: -3.7128 },
  precision: 'approximate',
  locality: null,
  country: 'Spain',
  countryCode: 'es',
  publishedAt: '2026-09-29T10:48:23.005Z',
  author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'ATINY' },
  content: 'Best wishes',
}

describe('latest homepage public messages', () => {
  it('reverse geocodes only legacy messages that have no locality', async () => {
    const withLocality = { ...baseMessage, publicId: '33333333-3333-4333-8333-333333333333', locality: 'Barcelona' }
    const resolveLocality = vi.fn(async () => 'Madrid')

    const messages = await enrichMissingLocalities([baseMessage, withLocality], resolveLocality)

    expect(messages.map((message) => message.locality)).toEqual(['Madrid', 'Barcelona'])
    expect(resolveLocality).toHaveBeenCalledOnce()
    expect(resolveLocality).toHaveBeenCalledWith(baseMessage.point)
  })

  it('keeps the country-only fallback when reverse geocoding is unavailable', async () => {
    const messages = await enrichMissingLocalities(
      [baseMessage],
      async () => { throw new Error('provider unavailable') },
    )

    expect(messages[0]?.locality).toBeNull()
  })
})
