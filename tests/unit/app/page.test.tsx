vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
/** @vitest-environment jsdom */

import { cleanup, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { render } from '@/../tests/support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)

vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

vi.mock('@clerk/nextjs', () => ({
  Show: ({ children, when }: PropsWithChildren<{ when: string }>) => (
    <div data-auth-state={when}>{children}</div>
  ),
  SignInButton: ({ children }: PropsWithChildren) => children,
  SignUpButton: ({ children }: PropsWithChildren) => children,
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  UserButton: () => <button aria-label="User account" type="button" />,
}))

vi.mock('../../../src/components/map/public-map-controller', () => ({
  PublicMapController: () => <div aria-label="Mapa de mensajes" />,
}))

vi.mock('../../../src/server/db/client', () => ({ getDb: vi.fn() }))
vi.mock('../../../src/server/messages/public-repository', () => ({
  listLatestPublicMessages: vi.fn(async () => []),
}))

vi.mock('../../../src/server/messages/latest-public-messages', () => ({
  listLatestHomepageMessages: vi.fn(async () => []),
  getHomepageStats: vi.fn(async () => ({ letters: 0, countries: 0 })),
}))

import SiteLayout from '@/app/(site)/layout'
import Home from '../../../src/app/(site)/page'

describe('Home', () => {
  it('renders the public application shell', async () => {
    render(<SiteLayout>{await Home({searchParams: Promise.resolve({})})}</SiteLayout>)

    expect(
      screen.getByRole('heading', {
        name: 'Messages across the seas',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ATINY World' })).toBeTruthy()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
  })

  it('declares the account actions for both session states', async () => {
    render(<SiteLayout>{await Home({searchParams: Promise.resolve({})})}</SiteLayout>)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('button', { name: 'My account' })).toBeTruthy()
  })
})
