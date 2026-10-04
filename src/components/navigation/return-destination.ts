type Locale = 'en' | 'es'
type Destination = 'map' | 'home' | 'letters' | 'about' | 'ownLetters' | 'letter'

const copy = {
  en: {
    map: 'the map', home: 'home', letters: 'letters', about: 'the project',
    ownLetters: 'my letters', letter: 'the letter',
  },
  es: {
    map: 'al mapa', home: 'al inicio', letters: 'a las cartas', about: 'al proyecto',
    ownLetters: 'a mis cartas', letter: 'a la carta',
  },
} as const

/** Accept only known reading destinations, never an external URL or a write/auth loop. */
export function returnDestination(lang: Locale, returnTo?: string | string[]) {
  const home = `/${lang}`
  let href = `${home}#map`
  let destination: Destination = 'map'

  if (typeof returnTo === 'string' && /^\/(en|es)(\/|#|\?|$)/.test(returnTo) && !/[\\\s]/.test(returnTo)) {
    const url = new URL(returnTo, 'https://atiny.invalid')
    const path = url.pathname.replace(/^\/(en|es)/, '')
    if (path === '' || path === '/') {
      const section = url.hash.slice(1)
      if (section === '' || section === 'map' || section === 'letters' || section === 'about') {
        destination = section === '' ? 'home' : section
        href = `${home}${url.search}${url.hash}`
      }
    } else if (path === '/my-messages') {
      destination = 'ownLetters'
      href = `${home}${path}${url.search}`
    } else if (/^\/messages\/[a-zA-Z0-9-]+$/.test(path) && path !== '/messages/new') {
      destination = 'letter'
      href = `${home}${path}`
    }
  }

  const target = copy[lang][destination]
  return {
    href,
    back: lang === 'es' ? `Volver ${target}` : `Back to ${target}`,
    cancel: lang === 'es' ? `Cancelar y volver ${target}` : `Cancel and return to ${target}`,
  }
}
