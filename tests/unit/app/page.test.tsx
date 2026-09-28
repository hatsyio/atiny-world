/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)

vi.mock('@clerk/nextjs', () => ({
  Show: ({ children, when }: PropsWithChildren<{ when: string }>) => (
    <div data-auth-state={when}>{children}</div>
  ),
  SignInButton: ({ children }: PropsWithChildren) => children,
  SignUpButton: ({ children }: PropsWithChildren) => children,
  UserButton: () => <button aria-label="User account" type="button" />,
}))

vi.mock('../../../src/components/map/public-map-controller', () => ({
  PublicMapController: () => <div aria-label="Mapa de mensajes" />,
}))

import Home from '../../../src/app/page'

describe('Home', () => {
  it('renders the public application shell', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', {
        name: 'Messages across the seas',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'atiny world, home' })).toBeTruthy()
    expect(screen.getByLabelText('Mapa de mensajes')).toBeTruthy()
  })

  it('declares the account actions for both session states', () => {
    render(<Home />)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/sign-in')
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/en/sign-up')
    expect(screen.getByRole('button', { name: 'User account' })).toBeTruthy()
  })
})
