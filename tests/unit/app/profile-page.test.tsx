/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
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

import ProfilePage from '../../../src/app/[lang]/profile/page'

afterEach(cleanup)

describe('profile recovery', () => {
  it('offers a username field instead of a retry loop when Clerk has no username', async () => {
    state.username = null
    render(await ProfilePage({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('heading', { name: 'Choose a username' })).toBeTruthy()
    expect(screen.getByLabelText('Username')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Try again' })).toBeNull()
  })

  it('offers a retry when Clerk already has a username', async () => {
    state.username = 'atiny_fan'
    render(await ProfilePage({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByLabelText('Username')).toBeNull()
  })
})

it.each(['en', 'es'] as const)('returns from account setup to the map in %s', async lang => {
  render(await ProfilePage({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver al mapa/ : /Back to the map/ })).toHaveAttribute('href', `/${lang}#map`)
})
