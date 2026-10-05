vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
import {setServerLocale} from '@/../tests/support/server-intl'
/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { render } from '@/../tests/support/intl'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ kind: 'allowed' }))
vi.mock('@clerk/nextjs', () => ({ SignIn: () => null, SignUp: () => null }))
vi.mock('@/server/auth/account-gate', () => ({
  resolveAccountGate: async () => ({ kind: state.kind }),
  writeLetterRedirect: () => null,
}))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: async () => ({ ok: false }) }))
vi.mock('@/components/messages/letter-detail', () => ({ LetterDetail: () => null }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: async () => ({ clerkUserId: 'user' }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/messages/own-message-repository', () => ({ pageOwnMessages: async () => ({ items: [{ publicId: 'letter-id' }], nextCursor: null }) }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: async () => ({ publicId: 'letter-id' }) }))
vi.mock('@/components/messages/my-message-list', () => ({ MyMessageList: () => null }))
vi.mock('@/components/messages/public-message-card', () => ({ PublicMessageCard: () => null }))
vi.mock('@/components/map/letter-location-map', () => ({ LetterLocationMap: () => null }))
vi.mock('@/components/messages/edit-message-form', () => ({ EditMessageForm: () => null }))
vi.mock('@/components/messages/create-message-flow', () => ({ CreateMessageFlow: ({ returnTo }: { returnTo: string }) => <span data-testid="form-destination">{returnTo}</span> }))

import SignInPage from '@/app/(site)/sign-in/[[...sign-in]]/page'
import SignUpPage from '@/app/(site)/sign-up/[[...sign-up]]/page'
import PublicMessagePage from '@/app/(site)/messages/[publicId]/page'
import MyMessagesPage from '@/app/(site)/my-messages/page'
import NewMessagePage from '@/app/(site)/messages/new/page'
import EditOwnMessagePage from '@/app/(site)/my-messages/[publicId]/edit/page'

afterEach(() => { cleanup(); state.kind = 'allowed' })

it.each(['en', 'es'] as const)('returns from direct internal links to the map in %s', async lang => {
  const params = Promise.resolve({ lang: setServerLocale(lang), publicId: 'letter-id' })
  for (const page of [
    () => SignInPage({ params, searchParams: Promise.resolve({}) }),
    () => SignUpPage({ params, searchParams: Promise.resolve({}) }),
    () => PublicMessagePage({ params }),
    () => MyMessagesPage({ params, searchParams: Promise.resolve({}) }),
    () => NewMessagePage({ params, searchParams: Promise.resolve({}) }),
  ]) {
    render(await page())
    expect(screen.getByRole('link', { name: lang === 'es' ? /Volver al mapa/ : /Back to the map/ })).toHaveAttribute('href', '/#map')
    cleanup()
  }
})

it.each(['en', 'es'] as const)('returns directly from editing to own letters in %s', async lang => {
  render(await EditOwnMessagePage({ params: Promise.resolve({ lang: setServerLocale(lang), publicId: 'letter-id' }) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver a mis cartas/ : /Back to my letters/ })).toHaveAttribute('href', '/my-messages')
})

it.each([
  ['/', 'Volver al inicio', '/'],
  ['/my-messages', 'Volver a mis cartas', '/my-messages'],
  ['/my-messages', 'Volver a mis cartas', '/my-messages'],
  ['https://evil.example', 'Volver al mapa', '/#map'],
] as const)('uses the same resolved writing destination for back and cancel: %s', async (returnTo, label, href) => {
  render(await NewMessagePage({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ returnTo }) }))
  expect(screen.getByRole('link', { name: `← ${label}` })).toHaveAttribute('href', href)
  expect(screen.getByTestId('form-destination')).toHaveTextContent(href)
})

it('keeps the map escape available for an unavailable writing account', async () => {
  state.kind = 'suspended'
  render(await NewMessagePage({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('link', { name: /Volver al mapa/ })).toHaveAttribute('href', '/#map')
  expect(screen.queryByTestId('form-destination')).toBeNull()
})

it.each([
  ['/#letters-letter-id', 'Volver a las cartas'],
  ['/my-messages?cursor=older#own-letter-id', 'Volver a mis cartas'],
  ['https://evil.example', 'Volver al mapa'],
] as const)('public detail resolves its reading origin: %s', async (returnTo, label) => {
  render(await PublicMessagePage({ params: Promise.resolve({ lang: setServerLocale('es'), publicId: 'letter-id' }), searchParams: Promise.resolve({ returnTo }) }))
  expect(screen.getByRole('link', { name: `← ${label}` })).toHaveAttribute('href', returnTo.startsWith('/') ? returnTo : '/#map')
})
