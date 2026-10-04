import { describe, expect, it } from 'vitest'
import { metadataBase } from '../../../src/i18n/metadata-base'

describe('canonical metadata origin', () => {
  it('uses an explicitly configured custom origin without leaking path or query', () => {
    expect(metadataBase({ SITE_URL: 'https://letters.example/map?language=es' }).href).toBe('https://letters.example/')
  })
  it('uses the stable Vercel project production origin on previews as well', () => {
    expect(metadataBase({ VERCEL_PROJECT_PRODUCTION_URL: 'atiny-world.vercel.app', VERCEL_URL: 'preview.vercel.app' }).href).toBe('https://atiny-world.vercel.app/')
  })
  it('supports local HTTP and rejects non-web or credential-bearing origins', () => {
    expect(metadataBase({ SITE_URL: 'http://localhost:3008' }).href).toBe('http://localhost:3008/')
    expect(metadataBase({ SITE_URL: 'javascript:alert(1)' }).href).toBe('http://localhost:3000/')
    expect(metadataBase({ SITE_URL: 'https://user:pass@example.com' }).href).toBe('http://localhost:3000/')
  })
})
