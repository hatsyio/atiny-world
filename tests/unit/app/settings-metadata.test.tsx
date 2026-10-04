/** @vitest-environment jsdom */
import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'
import {setServerLocale} from '@/../tests/support/server-intl'

const session = vi.hoisted(() => ({userId: 'user_1' as string | null}))
vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('@clerk/nextjs/server', () => ({auth: async () => session}))
vi.mock('next/navigation', () => ({redirect: (path: string) => {throw new Error(`redirect:${path}`)}}))
vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => <select aria-label="Language preference" />}))
vi.mock('@/components/account/profile-security-link', () => ({ProfileSecurityLink: () => <button>Profile security</button>}))
vi.mock('@/server/db/client', () => ({getDb: () => ({})}))
import SettingsPage from '@/app/(site)/settings/page'
import {generateMetadata} from '@/app/(site)/messages/[publicId]/page'

afterEach(() => {cleanup(); session.userId = 'user_1'})

it.each(['en', 'es'] as const)('provides language and account security in settings in %s', async locale => {
  setServerLocale(locale)
  render(await SettingsPage())
  expect(screen.getByRole('heading', {name: locale === 'es' ? 'Ajustes de cuenta' : 'Account settings'})).toBeInTheDocument()
  expect(screen.getByRole('combobox', {name: 'Language preference'})).toBeInTheDocument()
  expect(screen.getByRole('button', {name: 'Profile security'})).toBeInTheDocument()
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
