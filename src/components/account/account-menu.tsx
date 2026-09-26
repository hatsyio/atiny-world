'use client'

import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export function AccountMenu() {
  return <nav aria-label="Cuenta"><Link href="/en/sign-in">Sign in</Link><Link href="/en/sign-up">Sign up</Link><UserButton /></nav>
}
