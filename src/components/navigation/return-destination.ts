import {normalizeInternalDestination} from '@/server/http/locale'
import {navigationTranslator} from '@/i18n/navigation'
type Locale = 'en' | 'es'
type Destination = 'map' | 'home' | 'letters' | 'about' | 'ownLetters' | 'letter'

/** Accept only known reading destinations, never an external URL or a write/auth loop. */
export function returnDestination(lang: Locale, returnTo?: string | string[]) {
  const home = '/'
  let href = `${home}#map`
  let destination: Destination = 'map'

  const normalized = normalizeInternalDestination(returnTo)
  if (normalized) {
    const url = new URL(normalized, 'https://atiny.invalid')
    const path = url.pathname
    if (path === '' || path === '/') {
      const section = url.hash.slice(1)
      if (section === '' || section === 'map' || section === 'letters' || section === 'about') {
        destination = section === '' ? 'home' : section
        href = `${home}${url.search}${url.hash}`
      }
    } else if (path === '/my-messages') {
      destination = 'ownLetters'
      href = `${path}${url.search}${/^#own-[a-zA-Z0-9-]+$/.test(url.hash) ? url.hash : ''}`
    } else if (/^\/messages\/[a-zA-Z0-9-]+$/.test(path) && path !== '/messages/new') {
      destination = 'letter'
      href = `${path}`
    }
  }

  const t = navigationTranslator(lang)
  const target = t(`targets.${destination}`)
  return {href, back: t('back', {target}), cancel: t('cancel', {target})}
}
