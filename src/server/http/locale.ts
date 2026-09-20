const SUPPORTED_LOCALES = ['en', 'es'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function isLocalizedPath(pathname: string): boolean {
  if (pathname === '/') return false
  const [, segment] = pathname.split('/')
  return isSupportedLocale(segment ?? '')
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}