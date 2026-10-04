'use client'

import { useClerk } from '@clerk/nextjs'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { navigationCopy } from '@/components/navigation/copy'

export function AccountMenu({ lang, active = false, onNavigate }: {
  lang: 'en' | 'es'
  active?: boolean
  onNavigate?: () => void
}) {
  const t = navigationCopy[lang]
  const { openUserProfile, signOut } = useClerk()
  const [expanded, setExpanded] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setExpanded(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const close = () => { setExpanded(false); onNavigate?.() }

  return (
    <div className="account-menu" ref={container} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false)
    }} onKeyDown={event => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault()
        setExpanded(false)
        toggle.current?.focus()
      }
    }}>
      <button type="button" ref={toggle} aria-expanded={expanded} aria-controls="account-links" aria-current={active ? 'page' : undefined} onClick={() => setExpanded(!expanded)}>{t.account}</button>
      <div id="account-links" className="account-links" hidden={!expanded}>
        <Link href={`/${lang}/my-messages`} onClick={close}>{t.myLetters}</Link>
        <button type="button" onClick={() => { close(); openUserProfile() }}>{t.settings}</button>
        <button type="button" onClick={() => { close(); void signOut({ redirectUrl: `/${lang}` }) }}>{t.signOut}</button>
      </div>
    </div>
  )
}
