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

afterEach(cleanup)

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

  it('shows the pending publication beside the refreshed map without exposing a message link', () => {
    render(<PublicHome lang="es" publicationPending />)
    expect(screen.getByRole('status')).toHaveTextContent(/pendiente de moderación/i)
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })
})
