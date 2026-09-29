/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clerkState = vi.hoisted(() => ({ signedIn: true }))

vi.mock('@clerk/nextjs', () => ({
  Show: ({ children, when }: { children: React.ReactNode; when: string }) => (
    clerkState.signedIn === (when === 'signed-in') ? children : null
  ),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => <button aria-label="Cuenta" type="button" />,
}))

vi.mock('../../../src/components/map/public-map-controller', () => ({
  PublicMapController: () => <div aria-label="Mapa de mensajes" />,
}))

import { PublicHome } from '../../../src/app/[lang]/page'

afterEach(() => {
  clerkState.signedIn = true
  cleanup()
})

describe('PublicHome', () => {
  it('places account header, introduction, map, publication entry point and footer in order', () => {
    render(<PublicHome lang="en" />)
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Messages across the seas' })).toBeTruthy()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /send a letter/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Example letter')).toHaveLength(4)
  })

  it('shows the localized private letters link separately from the public letters section', () => {
    render(<PublicHome lang="es" />)

    expect(screen.getByRole('link', { name: 'Mis cartas' })).toHaveAttribute('href', '/es/my-messages')
    expect(screen.getByRole('link', { name: 'Cartas' })).toHaveAttribute('href', '#letters')
  })

  it('hides the private letters link for signed-out visitors', () => {
    clerkState.signedIn = false

    render(<PublicHome lang="en" />)

    expect(screen.queryByRole('link', { name: 'My letters' })).not.toBeInTheDocument()
  })

  it('keeps the private letters link in the active locale', () => {
    render(<PublicHome lang="en" />)

    expect(screen.getByRole('link', { name: 'My letters' })).toHaveAttribute('href', '/en/my-messages')
  })

  it('shows the pending publication beside the refreshed map without exposing a message link', () => {
    render(<PublicHome lang="es" publicationPending />)
    expect(screen.getByRole('status')).toHaveTextContent(/pendiente de moderación/i)
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })
})
