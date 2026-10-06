/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'

vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn() }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/settings', () => ({ getAdminSettings: vi.fn() }))
vi.mock('@/app/(site)/admin/settings/actions', () => ({ updateSettingsAction: vi.fn() }))

import AdminSettingsPage from '@/app/(site)/admin/settings/page'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { getAdminSettings } from '@/server/moderation/settings'

afterEach(() => { cleanup(); vi.resetAllMocks() })

it('guards direct requests before querying private settings', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Fan', role: 'fan' } })
  await expect(AdminSettingsPage()).rejects.toThrow('NOT_FOUND')
  expect(getAdminSettings).not.toHaveBeenCalled()
})

it('denies access when the role changes after the page guard', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'admin' })
  vi.mocked(getAdminSettings).mockResolvedValue({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'admin.settings.denied' } })
  await expect(AdminSettingsPage()).rejects.toThrow('NOT_FOUND')
})

it('renders the server-authorized configuration with its version and impact count', async () => {
  vi.mocked(authorizeSession).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'id', displayName: 'Admin', role: 'admin' } })
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'admin' })
  vi.mocked(getAdminSettings).mockResolvedValue({ ok: true, data: { premoderationEnabled: false, messageLimit: 10, cooldownSeconds: 10, version: 4, pendingActiveMessages: 3 } })
  render(await AdminSettingsPage())
  expect(getAdminSettings).toHaveBeenCalledWith({}, 'admin')
  expect(screen.getByRole('heading', { name: 'Operational settings' })).toBeVisible()
  expect(screen.getByDisplayValue('4')).toHaveAttribute('name', 'expectedVersion')
  expect(screen.getByDisplayValue('3')).toHaveAttribute('name', 'expectedPendingActiveMessages')
})
