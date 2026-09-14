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

import Home from '../../../src/app/page'

describe('Home', () => {
  it('renders the public application shell', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', {
        name: 'A world of good wishes for ATEEZ',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ATINY World, home' })).toBeTruthy()
  })

  it('declares the account actions for both session states', () => {
    render(<Home />)

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join the map' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'User account' })).toBeTruthy()
  })
})
