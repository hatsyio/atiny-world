/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'

vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), redirect: (path: string) => { throw new Error(`redirect:${path}`) }, notFound: () => { throw new Error('not-found') } }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/account-gate', () => ({ resolveAccountGate: vi.fn() }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn(), readProfileByClerkUserId: vi.fn() }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: vi.fn() }))
vi.mock('@/server/messages/own-message-repository', () => ({ getOwnMessage: vi.fn(), pageOwnMessages: async () => ({ items: [], nextCursor: null }) }))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))

import EditOwnMessagePage from '@/app/(site)/my-messages/[publicId]/edit/page'
import { resolveAccountGate } from '@/server/auth/account-gate'
import PublicMessagePage from '@/app/(site)/messages/[publicId]/page'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity, readProfileByClerkUserId } from '@/server/auth/session'
import { getVisibleMessage } from '@/server/messages/public-repository'
import { getOwnMessage } from '@/server/messages/own-message-repository'

const letter = {
  publicId: 'letter-1', version: 4, status: 'pending' as const,
  publicVisible: false,
  moderationReasonCode: null, moderationNote: null,
  content: 'Private pending letter', point: { latitude: 40.4, longitude: -3.7 },
  precision: 'approximate' as const, locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-09-29T10:00:00.000Z', author: { publicId: 'author-1', displayName: 'ATINY' },
}
beforeEach(() => {
  vi.mocked(resolveAccountGate).mockResolvedValue({ kind: 'allowed', profile: { profileId: 'profile-1', publicId: 'author-1', displayName: 'ATINY', role: 'fan' } })
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: 'profile-1', publicId: 'author-1', displayName: 'ATINY', role: 'fan' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'owner-1' })
  vi.mocked(readProfileByClerkUserId).mockResolvedValue({ id: 'profile-1', public_id: 'author-1', display_name: 'ATINY', role: 'fan', account_state: 'active', suspended_at: '2026-10-06T10:00:00Z' })
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  vi.mocked(getOwnMessage).mockResolvedValue(null)
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('lets the owner read and edit their pending letter without making it public', async () => {
  vi.mocked(getOwnMessage).mockResolvedValue(letter)
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByText('Private pending letter')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Edit letter' })).toBeVisible()
  expect(getOwnMessage).toHaveBeenCalledWith({}, { clerkUserId: 'owner-1', publicId: 'letter-1' })
  expect(screen.queryByRole('link', { name: 'Locate on the map' })).toBeNull()
})
it('does not expose a pending letter to another signed-in account', async () => {
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.queryByText('Private pending letter')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
})
it('shows a public letter without edit controls to a suspended account', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: false, error: { code: 'ACCOUNT_SUSPENDED' } })
  vi.mocked(getVisibleMessage).mockResolvedValue(letter)
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByText('Private pending letter')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Locate on the map' })).toHaveAttribute('href', '/map?letter=letter-1#map')
})
it('lets a suspended owner read their private letter without edit controls', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: false, error: { code: 'ACCOUNT_SUSPENDED' } })
  vi.mocked(getOwnMessage).mockResolvedValue(letter)
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByText('Private pending letter')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
})

it('does not expose a private letter to an administrator who is not its owner', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: 'admin-profile', publicId: 'admin-author', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'admin-user' })
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.queryByText('Private pending letter')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
})

it('does not expose a private letter when its owner is pending deletion', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: false, error: { code: 'ACCOUNT_DELETION_PENDING' } })
  vi.mocked(getOwnMessage).mockResolvedValue(letter)
  render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.queryByText('Private pending letter')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
})


it('loads the directly selected letter into the real edit form', async () => {
  vi.mocked(getOwnMessage).mockResolvedValue(letter)
  render(await EditOwnMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(screen.getByRole('textbox')).toHaveValue('Private pending letter')
  expect(getOwnMessage).toHaveBeenCalledWith({}, { clerkUserId: 'owner-1', publicId: 'letter-1' })
})

it.each(['fan', 'admin'] as const)('does not load a foreign letter into the edit form for a %s account', async role => {
  vi.mocked(resolveAccountGate).mockResolvedValue({ kind: 'allowed', profile: { profileId: 'other-profile', publicId: 'other-author', displayName: 'Other', role } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'other-user' })
  await expect(EditOwnMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) })).rejects.toThrow('not-found')
})

it.each(['suspended', 'deletion-pending'] as const)('redirects a %s account away from editing', async kind => {
  vi.mocked(resolveAccountGate).mockResolvedValue({ kind })
  vi.mocked(getOwnMessage).mockResolvedValue(letter)
  await expect(EditOwnMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) })).rejects.toThrow('redirect:/my-messages')
})
