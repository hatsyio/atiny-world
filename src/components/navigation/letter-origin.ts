import {normalizeInternalDestination} from '@/server/http/locale'
import {navigationTranslator} from '@/i18n/navigation'
type Locale = 'en' | 'es'

export interface MapView {
  latitude: number
  longitude: number
  zoom: number
}

type Search = Pick<URLSearchParams, 'get'>

export function readMapView(params: Search): MapView | undefined {
  const parts = params.get('mapView')?.split(',')
  if (!parts || parts.length !== 3 || parts.some(part => !part.trim())) return
  const [latitude, longitude, zoom] = parts.map(Number)
  if (![latitude, longitude, zoom].every(Number.isFinite) || Math.abs(latitude) > 85.05112878 || Math.abs(longitude) > 180 || zoom < 0 || zoom > 19) return
  return { latitude, longitude, zoom }
}

export function readMapFilters(params: Search) {
  return {
    city: [...(params.get('mapCity') ?? '')].slice(0, 100).join(''),
    country: /^[a-z]{2}$/.test(params.get('mapCountry') ?? '') ? params.get('mapCountry')! : '',
  }
}

export function mapOrigin(view: MapView, filters: { city?: string; country?: string }, path: '/' | '/map' = '/'): string {
  const longitude = ((view.longitude + 180) % 360 + 360) % 360 - 180
  const params = new URLSearchParams({ mapView: `${view.latitude},${longitude},${view.zoom}` })
  if (filters.city) params.set('mapCity', filters.city)
  if (filters.country) params.set('mapCountry', filters.country)
  return `${path}?${params}#map`
}

export function ownLetterOrigin(publicId: string, cursor?: string): string {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return `/my-messages${query}#own-${publicId}`
}

export function letterHref(publicId: string, origin: string): string {
  return `/messages/${publicId}?returnTo=${encodeURIComponent(origin)}`
}

/** Reading context is a destination allowlist, never an authorization or redirect. */
export function letterDestination(lang: Locale, returnTo?: string | string[]) {
  const t = navigationTranslator(lang)
  const fallback = { href: '/#map', back: t('backMap') }
  if (typeof returnTo !== 'string' || returnTo.length > 4096 || /[\\\s]/.test(returnTo)) return fallback
  const normalized = normalizeInternalDestination(returnTo)
  if (!normalized) return fallback
  const url = new URL(normalized, 'https://atiny.invalid')
  let destination: 'map' | 'letters' | 'ownLetters'
  let allowed: string[]
  if ((url.pathname === '/' || url.pathname === '/map') && url.hash === '#map') {
    destination = 'map'
    allowed = ['mapView', 'mapCity', 'mapCountry']
    if (url.searchParams.has('mapView') && !readMapView(url.searchParams)) return fallback
  } else if (url.pathname === '/letters' && /^(?:#letter-[a-zA-Z0-9-]+)?$/.test(url.hash)) {
    destination = 'letters'
    allowed = ['q', 'country', 'city', 'page']
  } else if (url.pathname === '/' && /^#letters(?:-[a-zA-Z0-9-]+)?$/.test(url.hash)) {
    destination = 'letters'
    allowed = []
  } else if (url.pathname === '/my-messages' && /^(?:#own-[a-zA-Z0-9-]+)?$/.test(url.hash)) {
    destination = 'ownLetters'
    allowed = ['cursor']
  } else return fallback
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return fallback
  const labels = {map: 'backMap', letters: 'backLetters', ownLetters: 'backOwnLetters'} as const
  return { href: `${url.pathname}${url.search}${url.hash}`, back: t(labels[destination]) }
}
