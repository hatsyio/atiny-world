vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
import {setServerLocale} from '@/../tests/support/server-intl'
/** @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react'
import {IntlTestProvider} from '@/../tests/support/intl'
import {render as testingRender} from '@testing-library/react'
let testLocale: 'en' | 'es' = 'en'
function render(ui: React.ReactElement) { return testingRender(<IntlTestProvider locale={testLocale}>{ui}</IntlTestProvider>) }
import { afterEach, expect, it, vi } from 'vitest'
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import type { NextRouter } from 'next/router'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('server-only', () => ({}))
vi.mock('@/components/map/public-map-controller', () => ({ PublicMapController: () => null }))
vi.mock('@/server/messages/public-repository', () => ({ getVisibleMessage: vi.fn(async () => null) }))
vi.mock('@/server/auth/authorize', () => ({ authorizeSession: vi.fn(async () => ({ ok: false })) }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))

import { PublicHome } from '@/app/(site)/page'
import { getVisibleMessage } from '@/server/messages/public-repository'
import PublicMessagePage from '@/app/(site)/messages/[publicId]/page'
import { MyMessageList } from '@/components/messages/my-message-list'

const letter = {
  publicId: 'letter-1', version: 1, status: 'approved' as const,
  moderationReasonCode: null, moderationNote: null,
  point: { latitude: 40.4, longitude: -3.7 }, precision: 'approximate' as const,
  locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-09-29T10:00:00.000Z',
  author: { publicId: 'author-1', displayName: 'ATINY Madrid' }, content: 'Gracias por vuestra música.',
}

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

it.each(['en', 'es'] as const)('returns Letters → letter → Letters to the same reading anchor in %s', async lang => {
  testLocale = lang
  setServerLocale(lang)
  window.history.replaceState(null, '', '/')
  const push = vi.fn()
  const router = { push, prefetch: vi.fn() } as unknown as NextRouter
  const home = render(<RouterContext.Provider value={router}><PublicHome lang={lang} latestLetters={[letter]} /></RouterContext.Provider>)
  const link = screen.getByRole('link', { name: /Madrid, España/ })
  const detail = new URL(link.getAttribute('href')!, window.location.origin)
  expect(detail.searchParams.get('returnTo')).toBe('/#letters-letter-1')
  fireEvent.click(link)
  expect(window.location.hash).toBe('#letters-letter-1')
  expect(push).toHaveBeenCalled()
  home.unmount()
  render(await PublicMessagePage({ params: Promise.resolve({ lang: setServerLocale(lang), publicId: 'letter-1' }), searchParams: Promise.resolve({ returnTo: detail.searchParams.get('returnTo')! }) }))
  const back = screen.getByRole('link', { name: lang === 'es' ? /Volver a las cartas/ : /Back to letters/ })
  expect(back).toHaveAttribute('href', '/#letters-letter-1')
  cleanup()
  render(<PublicHome lang={lang} latestLetters={[letter]} />)
  expect(document.getElementById('letters-letter-1')).toBeInTheDocument()
})

it.each(['en', 'es'] as const)('returns My letters → public letter → My letters with cursor and reading anchor in %s', async lang => {
  testLocale = lang
  setServerLocale(lang)
  window.history.replaceState(null, '', '/my-messages?cursor=older%2Bpage')
  const router = { push: vi.fn(), prefetch: vi.fn() } as unknown as NextRouter
  const list = render(<RouterContext.Provider value={router}><MyMessageList lang={lang} cursor="older+page" messages={[letter]} onEdit={() => {}} /></RouterContext.Provider>)
  const link = screen.getByRole('link', { name: lang === 'es' ? 'Localizar carta' : 'Locate letter' })
  const detail = new URL(link.getAttribute('href')!, window.location.origin)
  const origin = '/my-messages?cursor=older%2Bpage#own-letter-1'
  expect(detail.searchParams.get('returnTo')).toBe(origin)
  fireEvent.click(link)
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(origin)
  list.unmount()
  render(await PublicMessagePage({ params: Promise.resolve({ lang: setServerLocale(lang), publicId: 'letter-1' }), searchParams: Promise.resolve({ returnTo: detail.searchParams.get('returnTo')! }) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver a mis cartas/ : /Back to my letters/ })).toHaveAttribute('href', origin)
})

it.each(['en', 'es'] as const)('direct access after another exploration returns safely to the map in %s', async lang => {
  testLocale = lang
  setServerLocale(lang)
  window.history.replaceState(null, '', '/messages/letter-1')
  render(await PublicMessagePage({ params: Promise.resolve({ lang: setServerLocale(lang), publicId: 'letter-1' }) }))
  expect(screen.getByRole('link', { name: lang === 'es' ? /Volver al mapa/ : /Back to the map/ })).toHaveAttribute('href', '/#map')
})

it('renders the location of the visible letter without exploration controls', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValueOnce(letter)
  testLocale = 'en'
  setServerLocale('en')
  const { container } = render(await PublicMessagePage({ params: Promise.resolve({ publicId: 'letter-1' }) }))
  expect(container.querySelector('.message-map .map--static')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /fullscreen/i })).toBeNull()
})
