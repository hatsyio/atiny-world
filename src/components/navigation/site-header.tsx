'use client'

import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AccountMenu } from '@/components/account/account-menu'
import { getPublicAppIdentity } from '@/app-identity'
import {useLocale, useTranslations} from 'next-intl'
import { returnDestination } from './return-destination'
import { containsOverlayTarget } from '@/components/ui/contains-overlay-target'

type Section = 'home' | 'map' | 'letters'

export function SiteHeader({ canAdminister = false }: { canAdminister?: boolean }) {
  const lang = useLocale()
  const t = useTranslations('Navigation')
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()
  const home = '/'
  const isHome = pathname === '/'
  const [section, setSection] = useState<Section>('home')
  const [openedPath, setOpenedPath] = useState<string | null>(null)
  const expanded = openedPath === pathname
  const toggle = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isHome) return
    const readHash = () => {
      const hash = window.location.hash.slice(1)
      if (hash === 'map' || hash === 'letters') setSection(hash)
      else if (hash === 'about') readScroll()
      else setSection('home')
    }
    const readScroll = () => {
      const boundary = window.innerHeight * 0.25
      let current: Section = 'home'
      for (const id of ['map', 'letters'] as const) {
        const element = document.getElementById(id)
        if (!element) continue
        const top = element.getBoundingClientRect().top
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
        if (top <= boundary || (atBottom && top < window.innerHeight)) current = id
      }
      setSection(current)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    window.addEventListener('scroll', readScroll, { passive: true })
    return () => {
      window.removeEventListener('hashchange', readHash)
      window.removeEventListener('scroll', readScroll)
    }
  }, [isHome, pathname])

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!containsOverlayTarget(header.current, event.target)) setOpenedPath(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const writing = pathname === '/messages/new'
  const origin = returnDestination(lang, !isHome && !writing ? pathname ?? undefined : undefined)
  const writeHref = `/messages/new${origin.href !== `${home}#map` ? `?returnTo=${encodeURIComponent(origin.href)}` : ''}`
  const reading = !writing && pathname?.startsWith('/messages/')
  const account = pathname?.startsWith('/my-messages') || pathname?.startsWith('/admin') || pathname === '/profile' || pathname === '/settings'
  const close = () => setOpenedPath(null)
  const current = (id: Section) => isHome && (section === id || (id === 'home' && section === 'letters')) ? (id === 'home' ? 'page' : 'location') : undefined

  return (
    <header className="site-header" ref={header} onKeyDown={event => {
      if (event.key === 'Escape' && expanded && !event.defaultPrevented) {
        close()
        toggle.current?.focus()
      }
    }}>
      <Link className="nav-brand" href={home} onClick={close}>
        <span className="nav-compass" aria-hidden="true">✧</span>
        <span>{getPublicAppIdentity().name}</span>
      </Link>
      <button className="navigation-toggle" type="button" ref={toggle} aria-expanded={expanded} aria-controls="global-navigation" onClick={() => setOpenedPath(expanded ? null : pathname)}>{t('menu')}</button>
      <nav className="main-nav" id="global-navigation" aria-label={t('navigation')} data-open={expanded} onClick={event => {
        const link = (event.target as Element).closest('a')
        if (!link) return
        if (expanded && isHome) {
          const href = link.getAttribute('href')
          const id = href === home ? 'home' : href?.startsWith(`${home}#`) ? href.split('#')[1] : null
          if (id) document.getElementById(id)?.focus({ preventScroll: true })
        }
        close()
      }}>
        <Link href={home} aria-current={current('home')}>{t('home')}</Link>
        <Link href={`${home}#map`} aria-current={current('map')}>{t('map')}</Link>
        <Link href="/letters" aria-current={reading || pathname === '/letters' ? 'page' : undefined}>{t('letters')}</Link>
        <Link className="navigation-write" href={writeHref} aria-current={writing ? 'page' : undefined}>{t('write')}</Link>
        <AccountMenu
          visitor={!isSignedIn}
          disabled={!isLoaded}
          canAdminister={canAdminister}
          active={Boolean(isSignedIn ? account : pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up'))}
          onNavigate={close}
        />
      </nav>
    </header>
  )
}
