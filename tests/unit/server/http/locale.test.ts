import { describe, expect, it } from 'vitest'

import {
  isApiPath,
  isLocalizedPath,
  isSupportedLocale,
} from '../../../../src/server/http/locale'

describe('isSupportedLocale', () => {
  it('accepts only en and es', () => {
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('es')).toBe(true)
    expect(isSupportedLocale('de')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
  })
})

describe('isLocalizedPath', () => {
  it('recognizes localized UI paths', () => {
    expect(isLocalizedPath('/en')).toBe(true)
    expect(isLocalizedPath('/en/messages/abc')).toBe(true)
    expect(isLocalizedPath('/es/sign-in')).toBe(true)
  })

  it('rejects unprefixed and foreign-prefixed paths', () => {
    expect(isLocalizedPath('/')).toBe(false)
    expect(isLocalizedPath('/messages/abc')).toBe(false)
    expect(isLocalizedPath('/en-gb')).toBe(false)
    expect(isLocalizedPath('/misc')).toBe(false)
  })
})

describe('isApiPath', () => {
  it('recognizes API routes as unlocalized', () => {
    expect(isApiPath('/api')).toBe(true)
    expect(isApiPath('/api/map/features')).toBe(true)
  })

  it('rejects UI paths', () => {
    expect(isApiPath('/en')).toBe(false)
    expect(isApiPath('/map')).toBe(false)
    expect(isApiPath('/apix')).toBe(false)
  })
})