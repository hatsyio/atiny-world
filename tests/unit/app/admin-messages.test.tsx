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

afterEach(() => { cleanup(); vi.resetAllMocks() })
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
