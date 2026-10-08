vi.mock('@/components/i18n/language-switcher', () => ({LanguageSwitcher: () => null}))
/** @vitest-environment jsdom */

import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '@/../tests/support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clerkState = vi.hoisted(() => ({ signedIn: true }))
vi.mock('next-intl/server', () => import('@/../tests/support/server-intl'))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ usePathname: () => '' }))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: clerkState.signedIn }),
  Show: ({ children, when }: { children: React.ReactNode; when: string }) => (
    clerkState.signedIn === (when === 'signed-in') ? children : null
  ),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  UserButton: () => <button aria-label="Cuenta" type="button" />,
}))

vi.mock('../../../src/components/map/public-map-controller', () => ({
  PublicMapController: () => <div aria-label="Mapa de mensajes" />,
}))

import { PublicHome } from '../../../src/app/(site)/page'
import { SiteHeader } from '@/components/navigation/site-header'
import { SiteFooter } from '@/components/navigation/site-footer'

function Home(props: React.ComponentProps<typeof PublicHome>) {
  return <><SiteHeader /><PublicHome {...props} /><SiteFooter /></>
}

afterEach(() => {
  clerkState.signedIn = true
  cleanup()
})

const letter = {
  publicId: 'letter-1',
  point: { latitude: 40.4, longitude: -3.7 },
  precision: 'approximate' as const,
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  publishedAt: '2026-09-29T10:00:00.000Z',
  author: { publicId: 'author-1', displayName: 'ATINY Madrid' },
  content: 'Gracias por vuestra música.',
}

describe('PublicHome', () => {
  it('places account header, introduction, map, publication entry point and footer in order', () => {
    render(<Home latestLetters={[letter]} />, { locale: 'en' })
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Messages across the seas' })).toBeTruthy()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /write a letter/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Gracias por vuestra música.')).toBeInTheDocument()
    expect(screen.getByText('🇪🇸')).toBeInTheDocument()
    expect(screen.getByText('Madrid, España')).toBeInTheDocument()
    expect(screen.queryByText('Dear ATEEZ,')).not.toBeInTheDocument()
    expect(screen.queryByText('♡')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Madrid, España/i })).toHaveAttribute('href', '/messages/letter-1?returnTo=%2F%23letters-letter-1')
  })

  it('shows the localized private letters link separately from the public letters section', () => {
    render(<Home />, { locale: 'es' })
    fireEvent.click(screen.getByRole('button', { name: 'Mi cuenta' }))

    expect(screen.getByRole('link', { name: 'Mis cartas' })).toHaveAttribute('href', '/my-messages')
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('href', '/#letters')
  })

  it('hides the private letters link for signed-out visitors', () => {
    clerkState.signedIn = false

    render(<Home />, { locale: 'en' })

    expect(screen.queryByRole('link', { name: 'My letters' })).not.toBeInTheDocument()
  })

  it('keeps the private letters link in the active locale', () => {
    render(<Home />, { locale: 'en' })
    fireEvent.click(screen.getByRole('button', { name: 'My account' }))

    expect(screen.getByRole('link', { name: 'My letters' })).toHaveAttribute('href', '/my-messages')
  })

  it('shows the pending publication beside the refreshed map without exposing a message link', () => {
    render(<Home publicationPending />, { locale: 'es' })
    expect(screen.getByText(/pendiente de moderación/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })

  it('shows a clear localized empty state when no public letters exist', () => {
    render(<Home />, { locale: 'es' })

    expect(screen.getByRole('status')).toHaveTextContent(/todavía no hay cartas públicas/i)
  })

  it('shows the localized homepage statistics and the fixed number of pirates', () => {
    render(<Home homepageStats={{ letters: 12, countries: 5 }} />, { locale: 'en' })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Letters', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Countries', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Pirates', { selector: 'span' })).toBeInTheDocument()
  })

  it('uses singular labels when a statistic is exactly one', () => {
    render(<Home homepageStats={{ letters: 1, countries: 1 }} />, { locale: 'en' })

    expect(screen.getByText('Letter', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Country', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows zero for letter and country statistics when the public collection is empty', () => {
    render(<Home homepageStats={{ letters: 0, countries: 0 }} />, { locale: 'es' })

    expect(screen.getAllByText('0')).toHaveLength(2)
    expect(screen.getByText('Cartas', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Países', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Piratas', { selector: 'span' })).toBeInTheDocument()
  })
})

it.each([['en', '12,345'], ['es', '12.345']] as const)('formats homepage statistics for the reader in %s', (lang, number) => {
  render(<Home homepageStats={{letters: 12345, countries: 12345}} />, { locale: lang })
  expect(screen.getAllByText(number, {selector: 'strong'})).toHaveLength(2)
})
