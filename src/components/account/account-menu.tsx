'use client'

import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export function AccountMenu() {
  return <nav aria-label="Cuenta"><SignInButton><button type="button">Sign in</button></SignInButton><SignUpButton><button type="button">Sign up</button></SignUpButton><UserButton /></nav>
}
