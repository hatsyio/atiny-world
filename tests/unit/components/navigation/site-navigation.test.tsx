/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ pathname: '/es', signedIn: false, openUserProfile: vi.fn(), signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@clerk/nextjs', () => ({
  Show: ({ when, children }: { when: string; children: React.ReactNode }) => state.signedIn === (when === 'signed-in') ? children : null,
  useClerk: () => ({ openUserProfile: state.openUserProfile, signOut: state.signOut }),
}))
import { SiteHeader } from '@/components/navigation/site-header'
import { SiteFooter } from '@/components/navigation/site-footer'
import LocalizedLayout from '@/app/[lang]/layout'

afterEach(() => { cleanup(); state.pathname = '/es'; state.signedIn = false; vi.clearAllMocks(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); })

describe('shared navigation', () => {
  it.each(['', '/messages/letter-1', '/messages/new', '/my-messages', '/my-messages/letter-1/edit', '/sign-in', '/sign-up', '/profile'])('keeps destinations and order on /es%s', (suffix) => {
    state.pathname = `/es${suffix}`
    render(<SiteHeader lang="es" />)
    const links = within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link')
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Inicio', '/es'], ['Mapa', '/es#map'], ['Cartas', '/es#letters'], ['Escribir una carta', suffix === '/my-messages' || suffix === '/messages/letter-1' ? `/es/messages/new?returnTo=${encodeURIComponent(`/es${suffix}`)}` : '/es/messages/new'], ['Entrar', '/es/sign-in'], ['Registrarse', '/es/sign-up'],
    ])
    expect(screen.getByRole('link', { name: 'ATINY World' })).toHaveAttribute('href', '/es')
    expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current')).length).toBeLessThanOrEqual(1)
  })
  it.each([['/es/messages/new', 'Escribir una carta'], ['/es/messages/id', 'Cartas'], ['/es/my-messages', 'Mi cuenta'], ['/es/my-messages/id/edit', 'Mi cuenta'], ['/es/profile', 'Mi cuenta']])('marks the current destination on %s', (pathname, label) => {
    state.pathname = pathname; state.signedIn = true
    render(<SiteHeader lang="es" />)
    expect(screen.getByText(label)).toHaveAttribute('aria-current', 'page')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
  })
  it('groups localized own letters, existing account settings and sign out', async () => {
    state.pathname = '/en/my-messages'; state.signedIn = true
    render(<SiteHeader lang="en" />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'My account' }))
    expect(screen.getByRole('link', { name: 'My letters' })).toHaveAttribute('href', '/en/my-messages')
    await user.click(screen.getByRole('button', { name: 'Account settings' }))
    expect(state.openUserProfile).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'My account' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(state.signOut).toHaveBeenCalledWith({ redirectUrl: '/en' })
  })
  it('closes the mobile disclosure with Escape and restores focus', async () => {
    render(<SiteHeader lang="es" />)
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
    render(<SiteHeader lang="es" />)
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
    render(<><SiteHeader lang="es" /><section id="map" /><section id="letters" /></>)
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
    render(<><SiteHeader lang="es" /><section id="map" /><section id="letters" /></>)
    vi.spyOn(document.getElementById('map')!, 'getBoundingClientRect').mockReturnValue({ top: -900 } as DOMRect)
    vi.spyOn(document.getElementById('letters')!, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight * 0.4 } as DOMRect)
    fireEvent.scroll(window)
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('aria-current', 'location')
  })
  it('preserves the visible section when the footer anchor changes the hash', () => {
    render(<><SiteHeader lang="es" /><section id="map" /><section id="letters" /></>)
    vi.spyOn(document.getElementById('map')!, 'getBoundingClientRect').mockReturnValue({ top: -900 } as DOMRect)
    vi.spyOn(document.getElementById('letters')!, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    act(() => { window.history.replaceState(null, '', '#about'); fireEvent(window, new HashChangeEvent('hashchange')) })
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('aria-current', 'location')
  })
  it('moves focus to the destination when a mobile anchor closes the menu', async () => {
    render(<><SiteHeader lang="es" /><section id="map" tabIndex={-1} /></>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    screen.getByRole('link', { name: 'Mapa' }).addEventListener('click', event => event.preventDefault())
    await user.click(screen.getByRole('link', { name: 'Mapa' }))
    expect(document.getElementById('map')).toHaveFocus()
  })
  it.each(['en', 'es'] as const)('wraps internal content with one shared header and a project footer in %s', async lang => {
    state.pathname = `/${lang}/profile`
    render(await LocalizedLayout({ params: Promise.resolve({ lang }), children: <main>Profile</main> }))
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(screen.getByRole('link', { name: lang === 'es' ? 'Sobre el proyecto' : 'About the project' })).toHaveAttribute('href', '#about')
    expect(document.getElementById('about')).toHaveTextContent(lang === 'es' ? 'Sin afiliación' : 'Not affiliated')
  })
  it('renders a localized footer independently', () => {
    render(<SiteFooter lang="es" />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Un proyecto independiente')
  })
})

it.each(['/es/my-messages', '/es/messages/letter-1'])('carries the reading origin into writing from %s', pathname => {
  state.pathname = pathname
  render(<SiteHeader lang="es" />)
  const link = screen.getByRole('link', { name: 'Escribir una carta' })
  const url = new URL(link.getAttribute('href')!, 'https://atiny.invalid')
  expect(url.pathname).toBe('/es/messages/new')
  expect(url.searchParams.get('returnTo')).toBe(pathname)
})
