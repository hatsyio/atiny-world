'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

import { letterHref } from './letter-origin'

/** Replace the source entry before pushing the detail, so browser Back has the same origin. */
export function rememberLetterOrigin(origin: string) {
  const path = origin.split(/[?#]/)[0]
  if (window.location.pathname === path) window.history.replaceState(window.history.state, '', origin)
}

export function LetterLink({ publicId, origin, children, ...props }: {
  publicId: string
  origin: string
} & Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'>) {
  return <Link {...props} href={letterHref(publicId, origin)} onNavigate={() => rememberLetterOrigin(origin)}>{children}</Link>
}
