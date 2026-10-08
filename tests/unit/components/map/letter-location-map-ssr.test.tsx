/** @vitest-environment node */

import { renderToString } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it, vi } from 'vitest'
import messages from '@/i18n/messages/en/map.json'
import { LocationSelectionMap } from '@/components/map/location-selection-map'
import forms from '@/i18n/messages/en/forms.json'
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

it('renders the interactive selector shell on the server without importing Leaflet', () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  expect(typeof window).toBe('undefined')
  const html = renderToString(<NextIntlClientProvider locale="en" messages={{ Forms: forms, Map: messages }} timeZone="UTC">
    <LocationSelectionMap precise={false} onPointChange={() => {}} />
  </NextIntlClientProvider>)
  expect(html).toContain('location-picker__precise-map')
  expect(html).not.toContain('leaflet-marker-icon')
})

it('renders the public map shell on the server without importing Leaflet or markercluster', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const { LeafletMap } = await import('@/components/map/leaflet-map')
  const html = renderToString(<NextIntlClientProvider locale="en" messages={{ Map: messages }} timeZone="UTC">
    <LeafletMap features={[]} onSelect={() => {}} />
  </NextIntlClientProvider>)
  expect(html).toContain('map__canvas')
  expect(html).not.toContain('leaflet-marker-icon')
})
