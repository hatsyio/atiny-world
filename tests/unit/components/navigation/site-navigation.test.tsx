import {IntlTestProvider} from '@/../tests/support/intl'
vi.mock('@/server/actions/language-preference', () => ({setLanguagePreference: vi.fn()}))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render as testingRender, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ pathname: '/', signedIn: false, openUserProfile: vi.fn(), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname, useRouter: () => ({refresh: vi.fn()}) }))
vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: string; children: React.ReactNode }) => state.signedIn === (when === 'signed-in') ? children : null,
  useClerk: () => ({ openUserProfile: state.openUserProfile, signOut: state.signOut }),
}))
import { SiteHeader } from '@/components/navigation/site-header'
import { SiteFooter } from '@/components/navigation/site-footer'
let testLocale: 'en' | 'es' = 'es'
function render(ui: React.ReactElement) { return testingRender(<IntlTestProvider locale={testLocale}>{ui}</IntlTestProvider>) }
import LocalizedLayout from '@/app/(site)/layout'
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/auth/authorize', () => ({ authorizeProfile: vi.fn() }))
vi.mock('@/server/accounts/suspension', () => ({ readOwnSuspensionReason: async () => 'privacy' }))
import { getSessionIdentity } from '@/server/auth/session'
import { authorizeProfile } from '@/server/auth/authorize'
beforeEach(() => { vi.mocked(getSessionIdentity).mockResolvedValue(null) })

afterEach(() => { cleanup(); testLocale = 'es'; state.pathname = '/'; state.signedIn = false; vi.clearAllMocks(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); })

describe('shared navigation', () => {
  it.each(['', '/messages/letter-1', '/messages/new', '/my-messages', '/my-messages/letter-1/edit', '/sign-in', '/sign-up', '/profile'])('keeps destinations and order on /es%s', (suffix) => {
    state.pathname = suffix || '/'
    render(<SiteHeader />)
    const links = within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link')
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Inicio', '/'], ['Mapa', '/#map'], ['Cartas', '/#letters'], ['Escribir una carta', suffix === '/my-messages' || suffix === '/messages/letter-1' ? `/messages/new?returnTo=${encodeURIComponent(suffix)}` : '/messages/new'],
    ])
    expect(screen.getByRole('link', { name: 'ATINY World' })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current')).length).toBeLessThanOrEqual(1)
  })
  it.each([['/messages/new', 'Escribir una carta'], ['/messages/id', 'Cartas'], ['/my-messages', 'Mi cuenta'], ['/my-messages/id/edit', 'Mi cuenta'], ['/profile', 'Mi cuenta'], ['/settings', 'Mi cuenta'], ['/admin/users', 'Mi cuenta']])('marks the current destination on %s', (pathname, label) => {
    state.pathname = pathname; state.signedIn = true
    render(<SiteHeader />)
    expect(screen.getByText(label)).toHaveAttribute('aria-current', 'page')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
  })
  it.each(['en', 'es'] as const)('groups visitor access and language under one account button in %s', async locale => {
    testLocale = locale
    render(<SiteHeader />)
    const user = userEvent.setup()
    const account = screen.getByRole('button', {name: locale === 'es' ? 'Mi cuenta' : 'My account'})
    expect(screen.queryByRole('link', {name: locale === 'es' ? 'Entrar' : 'Sign in'})).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    await user.click(account)
    expect(screen.getByRole('link', {name: locale === 'es' ? 'Entrar' : 'Sign in'})).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', {name: locale === 'es' ? 'Crear cuenta' : 'Create account'})).toHaveAttribute('href', '/sign-up')
    const language = screen.getByRole('combobox', {name: locale === 'es' ? 'Idioma' : 'Language'})
    language.focus()
    await user.keyboard('{Escape}')
    expect(account).toHaveFocus()
    expect(account).toHaveAttribute('aria-expanded', 'false')
    await user.click(account)
    fireEvent.pointerDown(document.body)
    expect(account).toHaveAttribute('aria-expanded', 'false')
  })
  it('groups localized own letters, existing account settings and sign out', async () => {
    testLocale = 'en'
    state.pathname = '/my-messages'; state.signedIn = true
    render(<SiteHeader />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'My account' }))
    expect(screen.getByRole('link', { name: 'My letters' })).toHaveAttribute('href', '/my-messages')
    expect(screen.getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/settings')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(state.signOut).toHaveBeenCalledWith({ redirectUrl: '/' })
  })
  it.each(['admin', 'owner'] as const)('adds administration to the account menu for an active %s', async role => {
    state.signedIn = true
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'user_admin' })
    vi.mocked(authorizeProfile).mockResolvedValue({ ok: true, data: { profileId: '1', publicId: 'profile', displayName: 'Admin', role } })
    render(await LocalizedLayout({ children: <main>Content</main> }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mi cuenta' }))
    const link = screen.getByRole('link', { name: 'Administración' })
    expect(link).toHaveAttribute('href', '/admin')
    link.addEventListener('click', event => event.preventDefault())
    await userEvent.setup().click(link)
    expect(screen.getByRole('button', { name: 'Mi cuenta' })).toHaveAttribute('aria-expanded', 'false')
  })
  it.each(['fan', 'unavailable', 'anonymous'])('hides administration for %s accounts', async kind => {
    state.signedIn = kind !== 'anonymous'
    if (kind !== 'anonymous') vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'user_fan' })
    vi.mocked(authorizeProfile).mockResolvedValue(kind === 'fan'
      ? { ok: true, data: { profileId: '1', publicId: 'profile', displayName: 'Fan', role: 'fan' } }
      : { ok: false, error: { code: 'ACCOUNT_SUSPENDED', messageKey: 'account.suspended' } })
    render(await LocalizedLayout({ children: <main>Content</main> }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mi cuenta' }))
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull()
    if (kind === 'anonymous') expect(authorizeProfile).not.toHaveBeenCalled()
  })
  it('closes the mobile disclosure with Escape and restores focus', async () => {
    render(<SiteHeader />)
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: 'Menú' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    screen.getByRole('link', { name: 'Mapa' }).focus()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    await user.click(toggle)
    screen.getByRole('link', { name: 'Cartas' }).addEventListener('click', event => event.preventDefault())
    await user.click(screen.getByRole('link', { name: 'Cartas' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
  it('closes the account disclosure on Escape and outside click', async () => {
    state.signedIn = true
    render(<SiteHeader />)
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: 'Mi cuenta' })
    await user.click(toggle)
    screen.getByRole('link', { name: 'Mis cartas' }).focus()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    fireEvent.pointerDown(document.body)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
  it('tracks the visible home section and hash changes with just one active link', () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(3000)
    let mapTop = 900, lettersTop = 1800
    render(<><SiteHeader /><section id="map" /><section id="letters" /></>)
    vi.spyOn(document.getElementById('map')!, 'getBoundingClientRect').mockImplementation(() => ({ top: mapTop }) as DOMRect)
    vi.spyOn(document.getElementById('letters')!, 'getBoundingClientRect').mockImplementation(() => ({ top: lettersTop }) as DOMRect)
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    act(() => { mapTop = -100; fireEvent.scroll(window) })
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'location')
    act(() => { lettersTop = 50; fireEvent.scroll(window) })
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('aria-current', 'location')
    act(() => { window.history.replaceState(null, '', '#map'); fireEvent(window, new HashChangeEvent('hashchange')) })
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'location')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
  })
  it('keeps letters active when the bottom of a short homepage limits scrolling', () => {
    render(<><SiteHeader /><section id="map" /><section id="letters" /></>)
    vi.spyOn(document.getElementById('map')!, 'getBoundingClientRect').mockReturnValue({ top: -900 } as DOMRect)
    vi.spyOn(document.getElementById('letters')!, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight * 0.4 } as DOMRect)
    fireEvent.scroll(window)
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('aria-current', 'location')
  })
  it('preserves the visible section when the footer anchor changes the hash', () => {
    render(<><SiteHeader /><section id="map" /><section id="letters" /></>)
    vi.spyOn(document.getElementById('map')!, 'getBoundingClientRect').mockReturnValue({ top: -900 } as DOMRect)
    vi.spyOn(document.getElementById('letters')!, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    act(() => { window.history.replaceState(null, '', '#about'); fireEvent(window, new HashChangeEvent('hashchange')) })
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('aria-current', 'location')
  })
  it('moves focus to the destination when a mobile anchor closes the menu', async () => {
    render(<><SiteHeader /><section id="map" tabIndex={-1} /></>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    screen.getByRole('link', { name: 'Mapa' }).addEventListener('click', event => event.preventDefault())
    await user.click(screen.getByRole('link', { name: 'Mapa' }))
    expect(document.getElementById('map')).toHaveFocus()
  })
  it.each(['en', 'es'] as const)('wraps internal content with one shared header and a project footer in %s', async lang => {
    state.pathname = '/profile'
    testLocale = lang
    render(await LocalizedLayout({children: <main>Profile</main>}))
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(screen.getByRole('link', { name: lang === 'es' ? 'Sobre el proyecto' : 'About the project' })).toHaveAttribute('href', '#about')
    expect(document.getElementById('about')).toHaveTextContent(lang === 'es' ? 'Sin afiliación' : 'Not affiliated')
  })
  it('renders a localized footer independently', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Un proyecto independiente')
  })
})

it.each(['/my-messages', '/messages/letter-1'])('carries the reading origin into writing from %s', pathname => {
  state.pathname = pathname
  render(<SiteHeader />)
  const link = screen.getByRole('link', { name: 'Escribir una carta' })
  const url = new URL(link.getAttribute('href')!, 'https://atiny.invalid')
  expect(url.pathname).toBe('/messages/new')
  expect(url.searchParams.get('returnTo')).toBe(pathname)
})

it('shows the suspended account a translated reason in the shared layout', async () => {
  state.signedIn = true
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'suspended' })
  vi.mocked(authorizeProfile).mockResolvedValue({ ok: false, error: { code: 'ACCOUNT_SUSPENDED', messageKey: 'account.suspended' } })
  render(await LocalizedLayout({ children: <main>Content</main> }))
  expect(screen.getByRole('status')).toHaveTextContent('Tu cuenta está suspendida')
  expect(screen.getByRole('status')).toHaveTextContent('Datos personales o información privada')
})
