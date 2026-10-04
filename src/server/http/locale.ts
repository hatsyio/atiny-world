export {isSupportedLocale, type Locale} from '@/i18n/locale'

export function isLocalizedPath(pathname: string): boolean {
  return /^\/(en|es)(\/|$)/.test(pathname)
}

export function stripLegacyLocale(pathname: string): string {
  return pathname.replace(/^\/(en|es)(?=\/|$)/, '') || '/'
}

/** Validate the raw path before URL normalization, rejecting encoded and dot paths. */
export function normalizeInternalDestination(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return
  const [rawPath] = value.split(/[?#]/)
  if (rawPath.includes('%') || rawPath.split('/').some(segment => segment === '.' || segment === '..')) return
  const path = stripLegacyLocale(rawPath)
  return path + value.slice(rawPath.length)
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}
