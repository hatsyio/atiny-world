/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'

vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') }, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/accounts', () => ({ searchAccounts: vi.fn() }))
vi.mock('@/app/(site)/admin/users/actions', () => ({ setAdministratorRoleAction: vi.fn(), setSuspensionAction: vi.fn() }))

import AdminLayout from '@/app/(site)/admin/layout'
import AdminUsersPage from '@/app/(site)/admin/users/page'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { searchAccounts } from '@/server/moderation/accounts'

afterEach(() => { cleanup(); vi.resetAllMocks() })

it.each(['fan', null])('does not render the admin layout for %s', async role => {
  vi.mocked(authorizeSession).mockResolvedValue(role ? { ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Fan', role: 'fan' } } : { ok: false, error: { code: 'NOT_FOUND', messageKey: 'auth.unauthenticated' } })
  await expect(AdminLayout({ children: <p>Private</p> })).rejects.toThrow('NOT_FOUND')
})
it('does not query users when a fan requests the page directly', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Fan', role: 'fan' } })
  await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  expect(searchAccounts).not.toHaveBeenCalled()
})
it.each(['admin', 'owner'] as const)('renders users with role controls only for owner (%s)', async role => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'actor', displayName: 'Actor', role } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'user_actor' })
  vi.mocked(searchAccounts).mockResolvedValue({ ok: true, data: { actorRole: role, hasMore: false, items: [{ publicId: 'target', displayName: 'ATINY fan', role: 'fan', roleVersion: 1, suspensionVersion: 1, state: 'active' }] } })
  render(await AdminUsersPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByText('ATINY fan')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Make administrator' }) !== null).toBe(role === 'owner')
  expect(screen.getByRole('button', { name: 'Suspend account' })).toBeVisible()
})

it.each([
  ['admin', 'admin', 'active', false], ['owner', 'admin', 'suspended', true],
  ['owner', 'owner', 'active', false], ['owner', 'fan', 'deletion_pending', false],
] as const)('offers suspension controls only for permitted targets (%s -> %s/%s)', async (role, targetRole, state, allowed) => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'actor', displayName: 'Actor', role } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(searchAccounts).mockResolvedValue({ ok: true, data: { actorRole: role, hasMore: false, items: [{ publicId: 'target', displayName: 'Target', role: targetRole, roleVersion: 1, suspensionVersion: 1, state }] } })
  render(await AdminUsersPage({ searchParams: Promise.resolve({}) }))
  expect(screen.queryByRole('button', { name: state === 'suspended' ? 'Reactivate account' : 'Suspend account' }) !== null).toBe(allowed)
})
