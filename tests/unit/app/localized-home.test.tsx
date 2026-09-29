/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs', () => ({
  Show: ({ children }: { children: React.ReactNode }) => children,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <button aria-label="Cuenta" type="button" />,
}))

vi.mock('../../../src/components/map/public-map-controller', () => ({
  PublicMapController: () => <div aria-label="Mapa de mensajes" />,
}))

import { PublicHome } from '../../../src/app/[lang]/page'

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

afterEach(cleanup)

describe('PublicHome', () => {
  it('places account header, introduction, map, publication entry point and footer in order', () => {
    render(<PublicHome lang="en" latestLetters={[letter]} />)
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Messages across the seas' })).toBeTruthy()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /send a letter/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Gracias por vuestra música.')).toBeInTheDocument()
    expect(screen.getByText('🇪🇸')).toBeInTheDocument()
    expect(screen.getByText('Madrid, España')).toBeInTheDocument()
    expect(screen.queryByText('Dear ATEEZ,')).not.toBeInTheDocument()
    expect(screen.queryByText('♡')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Madrid, España/i })).toHaveAttribute('href', '/en/messages/letter-1')
  })

  it('shows the pending publication beside the refreshed map without exposing a message link', () => {
    render(<PublicHome lang="es" publicationPending />)
    expect(screen.getByText(/pendiente de moderación/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })

  it('shows a clear localized empty state when no public letters exist', () => {
    render(<PublicHome lang="es" />)

    expect(screen.getByRole('status')).toHaveTextContent(/todavía no hay cartas públicas/i)
  })
})
