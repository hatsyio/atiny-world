/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ kind: 'allowed' }))
vi.mock('@clerk/nextjs', () => ({ SignIn: () => null, SignUp: () => null }))
vi.mock('@/server/auth/account-gate', () => ({
  resolveAccountGate: async () => ({ kind: state.kind }),
  writeLetterRedirect: () => null,
}))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: async () => ({ clerkUserId: 'user' }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/messages/own-message-repository', () => ({ pageOwnMessages: async () => ({ items: [{ publicId: 'letter-id' }], nextCursor: null }) }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: async () => ({ publicId: 'letter-id' }) }))
vi.mock('@/components/messages/my-message-list', () => ({ MyMessageList: () => null }))
vi.mock('@/components/messages/public-message-card', () => ({ PublicMessageCard: () => null }))
vi.mock('@/components/map/public-map-controller', () => ({ PublicMapController: () => null }))
vi.mock('@/components/messages/edit-message-form', () => ({ EditMessageForm: () => null }))
vi.mock('@/components/messages/create-message-flow', () => ({ CreateMessageFlow: ({ returnTo }: { returnTo: string }) => <span data-testid="form-destination">{returnTo}</span> }))

import SignInPage from '@/app/[lang]/sign-in/[[...sign-in]]/page'
import SignUpPage from '@/app/[lang]/sign-up/[[...sign-up]]/page'
import PublicMessagePage from '@/app/[lang]/messages/[publicId]/page'
import MyMessagesPage from '@/app/[lang]/my-messages/page'
import NewMessagePage from '@/app/[lang]/messages/new/page'
import EditOwnMessagePage from '@/app/[lang]/my-messages/[publicId]/edit/page'

afterEach(() => { cleanup(); state.kind = 'allowed' })

it.each(['en', 'es'] as const)('returns from direct internal links to the map in %s', async lang => {
  const params = Promise.resolve({ lang, publicId: 'letter-id' })
  for (const page of [
    () => SignInPage({ params, searchParams: Promise.resolve({}) }),
    () => SignUpPage({ params, searchParams: Promise.resolve({}) }),
    () => PublicMessagePage({ params }),
    () => MyMessagesPage({ params, searchParams: Promise.resolve({}) }),
    () => NewMessagePage({ params, searchParams: Promise.resolve({}) }),
  ]) {
    render(await page())
    expect(screen.getByRole('link', { name: lang === 'es' ? /Volver al mapa/ : /Back to the map/ })).toHaveAttribute('href', `/${lang}#map`)
    cleanup()
  }
})

it.each(['en', 'es'] as const)('returns directly from editing to own letters in %s', async lang => {
  render(await EditOwnMessagePage({ params: Promise.resolve({ lang, publicId: 'letter-id' }) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver a mis cartas/ : /Back to my letters/ })).toHaveAttribute('href', `/${lang}/my-messages`)
})

it.each([
  ['/es', 'Volver al inicio', '/es'],
  ['/es/my-messages', 'Volver a mis cartas', '/es/my-messages'],
  ['/en/my-messages', 'Volver a mis cartas', '/es/my-messages'],
  ['https://evil.example', 'Volver al mapa', '/es#map'],
] as const)('uses the same resolved writing destination for back and cancel: %s', async (returnTo, label, href) => {
  render(await NewMessagePage({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ returnTo }) }))
  expect(screen.getByRole('link', { name: `← ${label}` })).toHaveAttribute('href', href)
  expect(screen.getByTestId('form-destination')).toHaveTextContent(href)
})

it('keeps the map escape available for an unavailable writing account', async () => {
  state.kind = 'suspended'
  render(await NewMessagePage({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({}) }))
  expect(screen.getByRole('link', { name: /Volver al mapa/ })).toHaveAttribute('href', '/es#map')
  expect(screen.queryByTestId('form-destination')).toBeNull()
})

it.each([
  ['/es#letters-letter-id', 'Volver a las cartas'],
  ['/es/my-messages?cursor=older#own-letter-id', 'Volver a mis cartas'],
  ['https://evil.example', 'Volver al mapa'],
] as const)('public detail resolves its reading origin: %s', async (returnTo, label) => {
  render(await PublicMessagePage({ params: Promise.resolve({ lang: 'es', publicId: 'letter-id' }), searchParams: Promise.resolve({ returnTo }) }))
  expect(screen.getByRole('link', { name: `← ${label}` })).toHaveAttribute('href', returnTo.startsWith('/es') ? returnTo : '/es#map')
})
