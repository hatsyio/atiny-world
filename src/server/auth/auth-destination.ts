import { returnDestination } from '@/components/navigation/return-destination'

type Locale = 'en' | 'es'
export type AuthSearchParams = { next?: string | string[] }

/** Allow known localized action routes only; auth/profile routes would create loops. */
export function authDestination(locale: Locale, next: unknown): string {
  const home = `/${locale}`
  if (typeof next !== 'string' || next.length > 4096 || /[\\\s\u0000-\u001f\u007f]/.test(next)) return home
  const [path] = next.split(/[?#]/)
  if (path !== home && path !== `${home}/messages/new` && path !== `${home}/my-messages` &&
      !new RegExp(`^${home}/my-messages/[a-zA-Z0-9-]+/edit$`).test(path)) return home

  const url = new URL(next, 'https://atiny.invalid')
  if (url.pathname !== path) return home
  if (path === `${home}/messages/new`) {
    const origin = url.searchParams.get('returnTo')
    return origin ? `${path}?returnTo=${encodeURIComponent(returnDestination(locale, origin).href)}` : path
  }
  if (path === `${home}/my-messages`) {
    const cursor = url.searchParams.get('cursor')
    return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path
  }
  return path
}

export function authRoute(locale: Locale, route: 'sign-in' | 'sign-up' | 'auth/continue' | 'profile', next?: unknown): string {
  const destination = authDestination(locale, next)
  const path = `/${locale}/${route}`
  return destination === `/${locale}` ? path : `${path}?next=${encodeURIComponent(destination)}`
}
