export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]
export type LanguagePreference = Locale | 'auto'
export const VISITOR_LANGUAGE_COOKIE = 'atiny-language'
export const ACCOUNT_LANGUAGE_COOKIE = 'atiny-account-language'

export function isSupportedLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es'
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || isSupportedLocale(value)
}

export function negotiateLocale(header: string | null | undefined): Locale {
  const ranges = (header ?? '').split(',').flatMap((entry, index) => {
    const match = /^\s*([a-z]{1,8}(?:-[a-z0-9]{1,8})*|\*)\s*(?:;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(entry)
    if (!match) return []
    return [{ range: match[1].toLowerCase(), q: match[2] === undefined ? 1 : Number(match[2]), index }]
  })
  const candidates = locales.flatMap((locale) => {
    // A matching explicit range overrides wildcard, including an exclusion q=0.
    const matches = ranges.filter(({ range }) => range === locale || range.startsWith(`${locale}-`))
    const eligible = matches.length ? matches : ranges.filter(({ range }) => range === '*')
    eligible.sort((a, b) => b.q - a.q || a.index - b.index)
    const best = eligible[0]
    return best && best.q > 0 ? [{ locale, ...best }] : []
  })
  candidates.sort((a, b) => b.q - a.q || a.index - b.index)
  return candidates[0]?.locale ?? 'en'
}

export function encodeAccountPreference(owner: string, preference: LanguagePreference): string {
  return JSON.stringify({ owner, preference })
}

export function readAccountPreference(cookie: string | undefined, userId: string): LanguagePreference | null {
  try {
    const value: unknown = JSON.parse(cookie ?? '')
    if (value && typeof value === 'object' && 'owner' in value && value.owner === userId && 'preference' in value && isLanguagePreference(value.preference)) return value.preference
  } catch { /* Malformed cookies are ignored. */ }
  return null
}

export function resolveLanguage(input: {
  userId: string | null
  profilePreference?: LanguagePreference | null
  visitorCookie?: string
  accountCookie?: string
  acceptLanguage?: string | null
}): { locale: Locale; preference: LanguagePreference } {
  const anonymous = isLanguagePreference(input.visitorCookie) ? input.visitorCookie : 'auto'
  const profilePreference = isLanguagePreference(input.profilePreference) ? input.profilePreference : null
  const preference = input.userId
    ? profilePreference ?? readAccountPreference(input.accountCookie, input.userId) ?? (input.accountCookie ? 'auto' : anonymous)
    : anonymous
  return { locale: preference === 'auto' ? negotiateLocale(input.acceptLanguage) : preference, preference }
}
