vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
import {setServerLocale} from '@/../tests/support/server-intl'
/** @vitest-environment jsdom */

import { cleanup, screen } from '@testing-library/react'
import { render } from '@/../tests/support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ username: null as string | null }))

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: async () => ({ username: state.username }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('../../../src/server/auth/account-gate', () => ({
  resolveAccountGate: async () => ({ kind: 'incomplete' }),
}))
vi.mock('../../../src/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('../../../src/server/actions/recover-username', () => ({ recoverUsername: vi.fn() }))

import ProfilePage from '../../../src/app/(site)/profile/page'

afterEach(cleanup)

describe('profile recovery', () => {
  it('offers a username field instead of a retry loop when Clerk has no username', async () => {
    state.username = null
    render(await ProfilePage({ params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { name: 'Choose a username' })).toBeTruthy()
    expect(screen.getByLabelText('Username')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Try again' })).toBeNull()
  })

  it('offers a retry when Clerk already has a username', async () => {
    state.username = 'atiny_fan'
    render(await ProfilePage({ params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
  })
})

it.each(['en', 'es'] as const)('returns from account setup to the map in %s', async lang => {
  render(await ProfilePage({ params: Promise.resolve({ lang: setServerLocale(lang) }), searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver al mapa/ : /Back to the map/ })).toHaveAttribute('href', '/#map')
})

it('submits the validated pending action with the username recovery form', async () => {
  state.username = null
  const view = render(await ProfilePage({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next: '/messages/new' }) }))
  expect(view.container.querySelector('input[name="next"]')).toHaveValue('/messages/new')
})
