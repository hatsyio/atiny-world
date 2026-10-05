/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'

vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: vi.fn() }))
vi.mock('@/server/messages/own-message-repository', () => ({ pageOwnMessages: vi.fn() }))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))

import PublicMessagePage from '@/app/(site)/messages/[publicId]/page'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { getVisibleMessage } from '@/server/messages/public-repository'
import { pageOwnMessages } from '@/server/messages/own-message-repository'

const letter = {
  publicId: 'letter-1', version: 4, status: 'pending' as const,
  moderationReasonCode: null, moderationNote: null,
  content: 'Private pending letter', point: { latitude: 40.4, longitude: -3.7 },
  precision: 'approximate' as const, locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-09-29T10:00:00.000Z', author: { publicId: 'author-1', displayName: 'ATINY' },
}
beforeEach(() => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: 'profile-1', publicId: 'author-1', displayName: 'ATINY', role: 'fan' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'owner-1' })
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  vi.mocked(pageOwnMessages).mockResolvedValue({ items: [], nextCursor: null })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('lets the owner read and edit their pending letter without making it public', async () => {
  vi.mocked(pageOwnMessages).mockResolvedValue({ items: [letter], nextCursor: null })
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByText('Private pending letter')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Edit letter' })).toBeVisible()
  expect(pageOwnMessages).toHaveBeenCalledWith({}, { clerkUserId: 'owner-1', limit: 100 })
})
it('does not expose a pending letter to another signed-in account', async () => {
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.queryByText('Private pending letter')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
})
it('shows a public letter without edit controls to a suspended account', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: false, error: { code: 'ACCOUNT_SUSPENDED', messageKey: 'account.suspended' } })
  vi.mocked(getVisibleMessage).mockResolvedValue(letter)
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByText('Private pending letter')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
  expect(pageOwnMessages).not.toHaveBeenCalled()
})
