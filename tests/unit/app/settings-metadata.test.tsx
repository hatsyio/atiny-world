/** @vitest-environment jsdom */
import {cleanup, render, screen, within} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'
import {IntlTestProvider} from '@/../tests/support/intl'
import {setServerLocale} from '@/../tests/support/server-intl'

const session = vi.hoisted(() => ({userId: 'user_1' as string | null, role: 'fan' as 'fan' | 'admin' | 'owner'}))
vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('@clerk/nextjs/server', () => ({auth: async () => session}))
vi.mock('next/navigation', () => ({redirect: (path: string) => {throw new Error(`redirect:${path}`)}, useRouter: () => ({refresh: vi.fn()})}))
vi.mock('@/server/actions/language-preference', () => ({setLanguagePreference: vi.fn()}))
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({openUserProfile: vi.fn()}),
  UserProfile: Object.assign(
    ({children}: {children: React.ReactNode}) => <section aria-label="Clerk profile">{children}</section>,
    {Page: ({children}: {children: React.ReactNode}) => <>{children}</>},
  ),
}))
vi.mock('@/server/db/client', () => ({getDb: () => ({})}))
vi.mock('@/server/auth/authorize', () => ({authorizeSession: async () => ({ok: true, data: {profileId: '1', publicId: 'profile', displayName: 'Fan', role: session.role}})}))
import SettingsPage from '@/app/(site)/settings/page'
import {generateMetadata} from '@/app/(site)/messages/[publicId]/page'

afterEach(() => {cleanup(); session.userId = 'user_1'; session.role = 'fan'})

it.each(['fan', 'admin', 'owner'] as const)('offers administration only to privileged accounts (%s)', async role => {
  session.role = role
  setServerLocale('en')
  render(<IntlTestProvider locale="en">{await SettingsPage()}</IntlTestProvider>)
  expect(screen.queryByRole('link', {name: 'Administration'}) !== null).toBe(role !== 'fan')
})

it.each(['en', 'es'] as const)('embeds the language preference inside the account profile in %s', async locale => {
  setServerLocale(locale)
  render(<IntlTestProvider locale={locale}>{await SettingsPage()}</IntlTestProvider>)
  expect(screen.getByRole('heading', {name: locale === 'es' ? 'Ajustes de cuenta' : 'Account settings'})).toBeInTheDocument()
  expect(within(screen.getByRole('region', {name: 'Clerk profile'})).getByRole('combobox', {name: locale === 'es' ? 'Idioma' : 'Language'})).toBeInTheDocument()
  expect(screen.getByRole('heading', {name: locale === 'es' ? 'Preferencias' : 'Preferences'})).toBeInTheDocument()
})

it('requires a session before account settings', async () => {
  session.userId = null
  await expect(SettingsPage()).rejects.toThrow('redirect:/sign-in?next=%2Fsettings')
})

it.each(['en', 'es'] as const)('keeps public letter canonical independent of reader locale %s', async locale => {
  setServerLocale(locale)
  const metadata = await generateMetadata({params: Promise.resolve({publicId: 'letter-1'})})
  expect(metadata.alternates).toEqual({canonical: '/messages/letter-1'})
  expect(metadata.title).toBe(locale === 'es' ? 'Una carta de ATINY' : 'A letter from ATINY')
})
