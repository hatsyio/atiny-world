/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'
vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') }, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/message-repository', () => ({ searchModerationMessages: vi.fn() }))
vi.mock('@/app/(site)/admin/messages/actions', () => ({ moderateMessageAction: vi.fn() }))
import AdminMessagesPage from '@/app/(site)/admin/messages/page'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { searchModerationMessages } from '@/server/moderation/message-repository'
import { setServerLocale } from '../../support/server-intl'

afterEach(() => { cleanup(); vi.resetAllMocks(); setServerLocale('en') })
it.each([
  ['en', 'Oct 6, 2026, 10:00 AM UTC'],
  ['es', '6 oct 2026, 10:00 UTC'],
] as const)('formats the published date on the server in %s', async (locale, expectedLabel) => {
  setServerLocale(locale)
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(searchModerationMessages).mockResolvedValue({ ok: true, data: { items: [{
    publicId: '123e4567-e89b-42d3-a456-426614174000', version: 1, status: 'pending',
    content: 'Letter', authorName: 'ATINY', authorState: 'active', locality: null,
    country: 'South Korea', publishedAt: '2026-10-06T10:00:00.000Z',
    reasonCode: null, note: null, publicVisible: true, decisions: [],
  }], hasMore: false } })
  const { container } = render(await AdminMessagesPage({ searchParams: Promise.resolve({}) }), { locale })
  expect(container.querySelector('time')).toHaveTextContent(expectedLabel)
  expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-10-06T10:00:00.000Z')
})
it('guards direct requests before querying the private message queue', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Fan', role: 'fan' } })
  await expect(AdminMessagesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  expect(searchModerationMessages).not.toHaveBeenCalled()
})
it('denies access if the role was revoked between page authorization and the query', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(searchModerationMessages).mockResolvedValue({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'admin.moderation.denied' } })
  await expect(AdminMessagesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
})
it('defaults to pending messages and retains filters when paginating', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(searchModerationMessages).mockResolvedValue({ ok: true, data: { items: [], hasMore: true } })
  render(await AdminMessagesPage({ searchParams: Promise.resolve({ q: '100%', page: '2' }) }))
  expect(searchModerationMessages).toHaveBeenCalledWith({}, 'actor', { query: '100%', status: 'pending', page: 2 })
  expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/admin/messages?q=100%25&status=pending&page=3')
  expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue('pending')
})
