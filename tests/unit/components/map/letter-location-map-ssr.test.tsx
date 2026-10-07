/** @vitest-environment node */

import { renderToString } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it, vi } from 'vitest'
import messages from '@/i18n/messages/en/map.json'
import { LetterLocationMap } from '@/components/map/letter-location-map'

afterEach(() => vi.unstubAllEnvs())

it('renders the client-only map shell on the server without importing browser Leaflet', () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  expect(typeof window).toBe('undefined')
  const html = renderToString(
    <NextIntlClientProvider locale="en" messages={{ Map: messages }} timeZone="UTC">
      <LetterLocationMap point={{ latitude: 40.4, longitude: -3.7 }} content="Server-safe letter" />
    </NextIntlClientProvider>,
  )
  expect(html).toContain('map--static')
  expect(html).toContain('map__canvas')
  expect(html).not.toContain('leaflet-marker-icon')
})
