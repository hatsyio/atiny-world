vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
import {setServerLocale} from '@/../tests/support/server-intl'
/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { render } from '@/../tests/support/intl'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('server-only', () => ({}))

const state = vi.hoisted(() => ({ kind: 'anonymous' }))
vi.mock('@clerk/nextjs', () => ({
  SignIn: (props: Record<string, string>) => <div data-testid="auth" data-props={JSON.stringify(props)} />,
  SignUp: (props: Record<string, string>) => <div data-testid="auth" data-props={JSON.stringify(props)} />,
}))
vi.mock('@clerk/nextjs/server', () => ({ currentUser: async () => ({ username: 'fan123' }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
  notFound: () => { throw new Error('not-found') },
}))
vi.mock('@/server/auth/account-gate', async importOriginal => ({
  ...await importOriginal<object>(), resolveAccountGate: async () => ({ kind: state.kind }),
}))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: async () => ({ clerkUserId: 'user_123' }) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/messages/own-message-repository', () => ({ pageOwnMessages: async () => ({ items: [], nextCursor: null }) }))
vi.mock('@/server/actions/recover-username', () => ({ recoverUsername: vi.fn() }))

import SignIn from '@/app/(site)/sign-in/[[...sign-in]]/page'
import SignUp from '@/app/(site)/sign-up/[[...sign-up]]/page'
import Continue from '@/app/(site)/auth/continue/page'
import Profile from '@/app/(site)/profile/page'
import NewMessage from '@/app/(site)/messages/new/page'
import MyMessages from '@/app/(site)/my-messages/page'
import Edit from '@/app/(site)/my-messages/[publicId]/edit/page'

beforeEach(() => { state.kind = 'anonymous' })
afterEach(cleanup)

it.each(['es', 'en'])('carries the write action from the protected page to sign-in in %s', async lang => {
  await expect(NewMessage({ params: Promise.resolve({ lang: setServerLocale(lang) }), searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/sign-in?next=%2Fmessages%2Fnew')
})

it.each([SignIn, SignUp])('keeps the destination when switching auth mode and forces completion through the account gate', async Page => {
  render(await Page({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next: '/messages/new' }) }))
  const props = JSON.parse(screen.getByTestId('auth').getAttribute('data-props')!)
  expect(props.forceRedirectUrl).toBe('/auth/continue?next=%2Fmessages%2Fnew')
  expect(props.signUpUrl ?? props.signInUrl).toMatch(/^\/sign-(up|in)\?next=%2Fmessages%2Fnew$/)
  expect(props.signUpForceRedirectUrl ?? props.signInForceRedirectUrl).toBe(props.forceRedirectUrl)
})

it('resumes the write action after successful account setup', async () => {
  state.kind = 'allowed'
  const args = { params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next: '/messages/new' }) }
  await expect(Continue(args)).rejects.toThrow('redirect:/messages/new')
  await expect(Profile(args)).rejects.toThrow('redirect:/messages/new')
})

it('carries the action through incomplete setup and its retry', async () => {
  state.kind = 'incomplete'
  const args = { params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({ next: '/my-messages' }) }
  await expect(Continue(args)).rejects.toThrow('redirect:/profile?next=%2Fmy-messages')
  render(await Profile(args))
  expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/auth/continue?next=%2Fmy-messages')
})

it.each([undefined, 'https://evil.test', '//evil.test', '/auth/continue', '/profile', '/sign-in', '/sign-up', '/../sign-in', '/messages/%2Fnew', '/messages/new', ['/messages/new'], '/messages/new\\evil', '/messages/new\n'])('uses home for missing or unsafe destination %j', async next => {
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next }) })).rejects.toThrow('redirect:/')
})

it.each(['suspended', 'deletion-pending'])('sends %s accounts to a readable account status without resuming a protected action', async kind => {
  state.kind = kind
  await expect(Continue({ params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({ next: '/messages/new' }) })).rejects.toThrow('redirect:/profile?next=%2Fmessages%2Fnew')
  render(await Profile({ params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({ next: '/messages/new' }) }))
  expect(screen.getByText('Your account is not available right now.')).toBeTruthy()
})

it('preserves access to own letters and edit while still enforcing ownership', async () => {
  await expect(MyMessages({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/sign-in?next=%2Fmy-messages')
  const args = { params: Promise.resolve({ lang: setServerLocale('es'), publicId: 'letter-1' }) }
  await expect(Edit(args)).rejects.toThrow('redirect:/sign-in?next=%2Fmy-messages%2Fletter-1%2Fedit')
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next: '/my-messages/letter-1/edit' }) })).rejects.toThrow('redirect:/my-messages/letter-1/edit')
  await expect(Edit(args)).rejects.toThrow('not-found')
})

it('preserves pagination when access to own letters requires sign-in', async () => {
  await expect(MyMessages({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ cursor: 'older+page' }) })).rejects.toThrow('redirect:/sign-in?next=%2Fmy-messages%3Fcursor%3Dolder%252Bpage')
})

it('preserves the reading origin when writing requires sign-in', async () => {
  await expect(NewMessage({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ returnTo: '/my-messages?cursor=older' }) })).rejects.toThrow('redirect:/sign-in?next=%2Fmessages%2Fnew%3FreturnTo%3D%252Fmy-messages%253Fcursor%253Dolder')
})

it.each([SignIn, SignUp])('uses a safe continuation when auth is opened without an action or with an external destination', async Page => {
  for (const next of [undefined, 'https://evil.test']) {
    render(await Page({ params: Promise.resolve({ lang: setServerLocale('en') }), searchParams: Promise.resolve({ next }) }))
    const props = JSON.parse(screen.getByTestId('auth').getAttribute('data-props')!)
    expect(props.forceRedirectUrl).toBe('/auth/continue')
    expect(props.signUpUrl ?? props.signInUrl).toMatch(/^\/sign-(up|in)$/)
    cleanup()
  }
})

it('keeps the action when the session expires before continuation', async () => {
  await expect(Continue({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next: '/my-messages' }) })).rejects.toThrow('redirect:/sign-in?next=%2Fmy-messages')
})

it.each([
  ['/my-messages?cursor=older%2Bpage', '/my-messages?cursor=older%2Bpage'],
  ['/messages/new?returnTo=%2Fmy-messages%3Fcursor%3Dolder', '/messages/new?returnTo=%2Fmy-messages%3Fcursor%3Dolder'],
  ['/messages/new?redirect_url=https://evil.test', '/messages/new'],
])('resumes the sanitized action %s', async (next, destination) => {
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: setServerLocale('es') }), searchParams: Promise.resolve({ next }) })).rejects.toThrow(`redirect:${destination}`)
})
