/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

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

import SignIn from '@/app/[lang]/sign-in/[[...sign-in]]/page'
import SignUp from '@/app/[lang]/sign-up/[[...sign-up]]/page'
import Continue from '@/app/[lang]/auth/continue/page'
import Profile from '@/app/[lang]/profile/page'
import NewMessage from '@/app/[lang]/messages/new/page'
import MyMessages from '@/app/[lang]/my-messages/page'
import Edit from '@/app/[lang]/my-messages/[publicId]/edit/page'

beforeEach(() => { state.kind = 'anonymous' })
afterEach(cleanup)

it.each(['es', 'en'])('carries the write action from the protected page to sign-in in %s', async lang => {
  await expect(NewMessage({ params: Promise.resolve({ lang }), searchParams: Promise.resolve({}) })).rejects.toThrow(`redirect:/${lang}/sign-in?next=%2F${lang}%2Fmessages%2Fnew`)
})

it.each([SignIn, SignUp])('keeps the destination when switching auth mode and forces completion through the account gate', async Page => {
  render(await Page({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next: '/es/messages/new' }) }))
  const props = JSON.parse(screen.getByTestId('auth').getAttribute('data-props')!)
  expect(props.forceRedirectUrl).toBe('/es/auth/continue?next=%2Fes%2Fmessages%2Fnew')
  expect(props.signUpUrl ?? props.signInUrl).toMatch(/^\/es\/sign-(up|in)\?next=%2Fes%2Fmessages%2Fnew$/)
  expect(props.signUpForceRedirectUrl ?? props.signInForceRedirectUrl).toBe(props.forceRedirectUrl)
})

it('resumes the write action after successful account setup', async () => {
  state.kind = 'allowed'
  const args = { params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next: '/es/messages/new' }) }
  await expect(Continue(args)).rejects.toThrow('redirect:/es/messages/new')
  await expect(Profile(args)).rejects.toThrow('redirect:/es/messages/new')
})

it('carries the action through incomplete setup and its retry', async () => {
  state.kind = 'incomplete'
  const args = { params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({ next: '/en/my-messages' }) }
  await expect(Continue(args)).rejects.toThrow('redirect:/en/profile?next=%2Fen%2Fmy-messages')
  render(await Profile(args))
  expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en/auth/continue?next=%2Fen%2Fmy-messages')
})

it.each([undefined, 'https://evil.test', '//evil.test', '/es/auth/continue', '/es/profile', '/es/sign-in', '/es/sign-up', '/es/../sign-in', '/es/messages/%2Fnew', '/en/messages/new', ['/es/messages/new'], '/es/messages/new\\evil', '/es/messages/new\n'])('uses home for missing or unsafe destination %j', async next => {
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next }) })).rejects.toThrow('redirect:/es')
})

it.each(['suspended', 'deletion-pending'])('sends %s accounts to a readable account status without resuming a protected action', async kind => {
  state.kind = kind
  await expect(Continue({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({ next: '/en/messages/new' }) })).rejects.toThrow('redirect:/en/profile?next=%2Fen%2Fmessages%2Fnew')
  render(await Profile({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({ next: '/en/messages/new' }) }))
  expect(screen.getByText('Your account is not available right now.')).toBeTruthy()
})

it('preserves access to own letters and edit while still enforcing ownership', async () => {
  await expect(MyMessages({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/es/sign-in?next=%2Fes%2Fmy-messages')
  const args = { params: Promise.resolve({ lang: 'es', publicId: 'letter-1' }) }
  await expect(Edit(args)).rejects.toThrow('redirect:/es/sign-in?next=%2Fes%2Fmy-messages%2Fletter-1%2Fedit')
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next: '/es/my-messages/letter-1/edit' }) })).rejects.toThrow('redirect:/es/my-messages/letter-1/edit')
  await expect(Edit(args)).rejects.toThrow('not-found')
})

it('preserves pagination when access to own letters requires sign-in', async () => {
  await expect(MyMessages({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ cursor: 'older+page' }) })).rejects.toThrow('redirect:/es/sign-in?next=%2Fes%2Fmy-messages%3Fcursor%3Dolder%252Bpage')
})

it('preserves the reading origin when writing requires sign-in', async () => {
  await expect(NewMessage({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ returnTo: '/es/my-messages?cursor=older' }) })).rejects.toThrow('redirect:/es/sign-in?next=%2Fes%2Fmessages%2Fnew%3FreturnTo%3D%252Fes%252Fmy-messages%253Fcursor%253Dolder')
})

it.each([SignIn, SignUp])('uses a safe continuation when auth is opened without an action or with an external destination', async Page => {
  for (const next of [undefined, 'https://evil.test']) {
    render(await Page({ params: Promise.resolve({ lang: 'en' }), searchParams: Promise.resolve({ next }) }))
    const props = JSON.parse(screen.getByTestId('auth').getAttribute('data-props')!)
    expect(props.forceRedirectUrl).toBe('/en/auth/continue')
    expect(props.signUpUrl ?? props.signInUrl).toMatch(/^\/en\/sign-(up|in)$/)
    cleanup()
  }
})

it('keeps the action when the session expires before continuation', async () => {
  await expect(Continue({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next: '/es/my-messages' }) })).rejects.toThrow('redirect:/es/sign-in?next=%2Fes%2Fmy-messages')
})

it.each([
  ['/es/my-messages?cursor=older%2Bpage', '/es/my-messages?cursor=older%2Bpage'],
  ['/es/messages/new?returnTo=%2Fes%2Fmy-messages%3Fcursor%3Dolder', '/es/messages/new?returnTo=%2Fes%2Fmy-messages%3Fcursor%3Dolder'],
  ['/es/messages/new?redirect_url=https://evil.test', '/es/messages/new'],
])('resumes the sanitized action %s', async (next, destination) => {
  state.kind = 'allowed'
  await expect(Continue({ params: Promise.resolve({ lang: 'es' }), searchParams: Promise.resolve({ next }) })).rejects.toThrow(`redirect:${destination}`)
})
