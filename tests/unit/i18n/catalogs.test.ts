import { describe, expect, it } from 'vitest'
import { loadMessages } from '../../../src/i18n/messages'

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key)).sort()
}

describe('complete locale catalogs', () => {
  it('provides identical namespaces and translation keys in both locales', () => {
    expect(keys(loadMessages('es'))).toEqual(keys(loadMessages('en')))
    expect(Object.keys(loadMessages('en')).sort()).toEqual(['Forms', 'Map', 'Navigation', 'Pages', 'Settings'])
  })
})
