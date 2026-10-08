'use client'

import { useClerk } from '@clerk/nextjs'
import posthog from 'posthog-js'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import {LanguageSwitcher} from '@/components/i18n/language-switcher'
import {useTranslations} from 'next-intl'
import { containsOverlayTarget } from '@/components/ui/contains-overlay-target'

export function AccountMenu({ active = false, visitor = false, disabled = false, canAdminister = false, onNavigate }: {
  visitor?: boolean
  disabled?: boolean
  active?: boolean
  canAdminister?: boolean
  onNavigate?: () => void
}) {
  const linksId = useId()
  const t = useTranslations('Navigation')
  const { signOut } = useClerk()
  const [expanded, setExpanded] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!containsOverlayTarget(container.current, event.target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const close = () => { setExpanded(false); onNavigate?.() }

  return (
    <div className="account-menu" ref={container} onBlur={event => {
      if (!containsOverlayTarget(event.currentTarget, event.relatedTarget)) setExpanded(false)
    }} onKeyDown={event => {
      if (event.key === 'Escape' && expanded && !event.defaultPrevented) {
        event.preventDefault()
        setExpanded(false)
        toggle.current?.focus()
      }
    }}>
      <button type="button" ref={toggle} disabled={disabled} aria-expanded={expanded} aria-controls={linksId} aria-current={active ? 'page' : undefined} onClick={() => setExpanded(!expanded)}>{t('account')}</button>
      <div id={linksId} className="account-links" hidden={!expanded}>
        {visitor ? <>
          <Link className="account-sign-in" href="/sign-in" onClick={close}>{t('signIn')}</Link>
          <Link href="/sign-up" onClick={close}>{t('signUp')}</Link>
          <div className="account-language"><LanguageSwitcher variant="header" /></div>
        </> : <>
          <Link href="/my-messages" onClick={close}>{t('myLetters')}</Link>
          <Link href="/settings" onClick={close}>{t('settings')}</Link>
          {canAdminister ? <Link href="/admin" onClick={close}>{t('administration')}</Link> : null}
          <button type="button" onClick={() => { close(); posthog.reset(); void signOut({ redirectUrl: '/' }) }}>{t('signOut')}</button>
        </>}
      </div>
    </div>
  )
}
