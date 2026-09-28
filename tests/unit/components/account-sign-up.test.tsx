/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpWithPublicName } from '../../../src/components/account/sign-up-with-public-name'

const state = vi.hoisted(() => ({ savedName: undefined as string | undefined }))
vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: { unsafeMetadata: { publicName: state.savedName } } }),
}))
vi.mock('@clerk/nextjs', () => ({
  SignUp: ({ unsafeMetadata, fallbackRedirectUrl }: { unsafeMetadata: { publicName: string }; fallbackRedirectUrl: string }) =>
    <div data-testid="clerk-sign-up" data-name={unsafeMetadata.publicName} data-redirect={fallbackRedirectUrl} />,
}))

beforeEach(() => { state.savedName = undefined })
afterEach(() => { document.body.innerHTML = '' })

describe('sign-up public name', () => {
  it('shows the name and Clerk forms in separate steps and passes the Unicode name to Clerk', () => {
    render(<SignUpWithPublicName lang="es" />)
    expect(screen.queryByTestId('clerk-sign-up')).toBeNull()
    fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: '  ATINY 서울 🌙  ' } })
    expect(screen.queryByTestId('clerk-sign-up')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.queryByLabelText('Nombre público')).toBeNull()
    expect(screen.getByTestId('clerk-sign-up')).toHaveAttribute('data-name', 'ATINY 서울 🌙')
    expect(screen.getByTestId('clerk-sign-up')).toHaveAttribute('data-redirect', '/es/auth/continue')
    fireEvent.click(screen.getByRole('button', { name: /Cambiar nombre público/ }))
    expect(screen.getByLabelText('Nombre público')).toHaveValue('  ATINY 서울 🌙  ')
    expect(screen.queryByTestId('clerk-sign-up')).toBeNull()
  })

  it('restores a name stored on an interrupted Clerk signup', () => {
    state.savedName = 'ATINY 🌙'
    render(<SignUpWithPublicName lang="en" />)
    expect(screen.queryByLabelText('Public name')).toBeNull()
    expect(screen.queryByRole('button', { name: /Change public name/ })).toBeNull()
    expect(screen.getByTestId('clerk-sign-up')).toHaveAttribute('data-name', 'ATINY 🌙')
  })
})
