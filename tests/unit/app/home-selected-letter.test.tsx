import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: vi.fn() }))
vi.mock('@/server/messages/latest-public-messages', () => ({
  listLatestHomepageMessages: async () => [],
  getHomepageStats: async () => ({ letters: 0, countries: 0 }),
}))

import Page from '@/app/(site)/page'
import { getVisibleMessage } from '@/server/messages/public-repository'

beforeEach(() => vi.resetAllMocks())

it('resolves the map selection using public visibility and sends only map fields', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue({
    publicId: 'letter-1', content: 'Public letter',
    point: { latitude: 40.4, longitude: -3.7 }, precision: 'approximate',
    locality: 'Madrid', country: 'España', countryCode: 'es',
    publishedAt: '2026-10-06T10:00:00Z', author: { publicId: 'author-1', displayName: 'ATINY' },
  })
  const home = await Page({ searchParams: Promise.resolve({ letter: 'letter-1' }) })
  expect(getVisibleMessage).toHaveBeenCalledWith({}, 'letter-1')
  expect(home.props.selectedMessage).toMatchObject({ publicId: 'letter-1', point: { latitude: 40.4, longitude: -3.7 } })
  expect(home.props.selectedMessage).not.toHaveProperty('content')
})

it('does not send an unavailable letter to the public map', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  const home = await Page({ searchParams: Promise.resolve({ letter: 'hidden-letter' }) })
  expect(home.props.selectedMessage).toBeUndefined()
})

it('ignores malformed map selections', async () => {
  const home = await Page({ searchParams: Promise.resolve({ letter: '../private' }) })
  expect(getVisibleMessage).not.toHaveBeenCalled()
  expect(home.props.selectedMessage).toBeUndefined()
})
