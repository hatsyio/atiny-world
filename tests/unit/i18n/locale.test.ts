import { describe, expect, it } from 'vitest'
import { negotiateLocale, resolveLanguage, encodeAccountPreference } from '../../../src/i18n/locale'

describe('reader language negotiation', () => {
  it.each([
    ['es-MX,en;q=0.8', 'es'], ['es;q=0.1,en-GB;q=0.9', 'en'],
    ['es;q=0,en;q=0.5', 'en'], ['en;q=0,es;q=0.3', 'es'],
    ['fr,es-AR;q=0.9,en;q=0.8', 'es'], ['es;q=bad,en', 'en'],
    ['es;q=1.1', 'en'], ['???', 'en'], ['es;q=0,*;q=1', 'en'],
  ])('negotiates %s as %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected)
  })
  it('honors profile auto over stale explicit cookies', () => {
    expect(resolveLanguage({ userId: 'a', profilePreference: 'auto', visitorCookie: 'es', accountCookie: encodeAccountPreference('a', 'es'), acceptLanguage: 'en' })).toEqual({ locale: 'en', preference: 'auto' })
  })
  it('does not inherit another account or expose its cookie on logout', () => {
    const accountCookie = encodeAccountPreference('a', 'es')
    expect(resolveLanguage({ userId: 'b', accountCookie, visitorCookie: 'es', acceptLanguage: 'en' }).locale).toBe('en')
    expect(resolveLanguage({ userId: null, accountCookie, acceptLanguage: 'en' }).locale).toBe('en')
  })
  it('adopts anonymous manual selection for a first login', () => {
    expect(resolveLanguage({ userId: 'new', visitorCookie: 'es', acceptLanguage: 'en' })).toEqual({ locale: 'es', preference: 'es' })
  })
  it('honors an explicit profile before either cookie', () => {
    expect(resolveLanguage({ userId: 'a', profilePreference: 'en', visitorCookie: 'es', acceptLanguage: 'es' }).locale).toBe('en')
  })
})
