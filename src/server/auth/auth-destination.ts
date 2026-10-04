import {normalizeInternalDestination} from '@/server/http/locale'
import { returnDestination } from '@/components/navigation/return-destination'

type Locale = 'en' | 'es'
export type AuthSearchParams = { next?: string | string[] }

/** Allow known internal destinations only; auth/profile routes would create loops. */
export function authDestination(locale: Locale, next: unknown): string {
  const home = '/'
  if (typeof next !== 'string' || next.length > 4096 || /[\\\s\u0000-\u001f\u007f]/.test(next)) return home
  const normalized = normalizeInternalDestination(next)
  if (!normalized) return home
  const [path] = normalized.split(/[?#]/)
  if (path !== home && path !== '/messages/new' && path !== '/my-messages' && path !== '/settings' &&
      !new RegExp('^/my-messages/[a-zA-Z0-9-]+/edit$').test(path)) return home

  const url = new URL(normalized, 'https://atiny.invalid')
  if (url.pathname !== path) return home
  if (path === '/messages/new') {
    const origin = url.searchParams.get('returnTo')
    return origin ? `${path}?returnTo=${encodeURIComponent(returnDestination(locale, origin).href)}` : path
  }
  if (path === '/my-messages') {
    const cursor = url.searchParams.get('cursor')
    return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
  }
  return path
}

export function authRoute(locale: Locale, route: 'sign-in' | 'sign-up' | 'auth/continue' | 'profile', next?: unknown): string {
  const destination = authDestination(locale, next)
  const path = `/${route}`
  return destination === '/' ? path : `${path}?next=${encodeURIComponent(destination)}`
}
