'use client'

import { useClerk } from '@clerk/nextjs'
import posthog from 'posthog-js'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import {LanguageSwitcher} from '@/components/i18n/language-switcher'
import {useTranslations} from 'next-intl'

export function AccountMenu({ active = false, visitor = false, canAdminister = false, onNavigate }: {
  lang?: 'en' | 'es'
  visitor?: boolean
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
      <button type="button" ref={toggle} aria-expanded={expanded} aria-controls={linksId} aria-current={active ? 'page' : undefined} onClick={() => setExpanded(!expanded)}>{t('account')}</button>
      <div id={linksId} className="account-links" hidden={!expanded}>
        {visitor ? <>
          <Link className="account-sign-in" href="/sign-in" onClick={close}>{t('signIn')}</Link>
          <Link href="/sign-up" onClick={close}>{t('signUp')}</Link>
          <div className="account-language"><LanguageSwitcher /></div>
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
