/** @vitest-environment jsdom */
import leaflet from 'leaflet'
import 'leaflet.markercluster'
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { LeafletMap } from '@/components/map/leaflet-map'
import type { PublicMapFeature } from '@/domain/messages/public-message'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
it('updates a published point without recreating its marker or map', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const feature: PublicMapFeature = { publicId: '11111111-1111-4111-8111-111111111111', point: { latitude: 40, longitude: -3 }, precision: 'approximate', locality: 'Madrid', country: 'España', countryCode: 'es', publishedAt: '2026-09-25T10:00:00Z', author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'Fan' } }
  const view = render(<LeafletMap features={[feature]} onSelect={() => {}} />)
  await waitFor(() => expect(factory).toHaveReturned())
  const map = factory.mock.results[0].value as leaflet.Map
  let group: leaflet.MarkerClusterGroup | undefined
  await waitFor(() => { map.eachLayer(layer => { if (layer instanceof leaflet.MarkerClusterGroup) group = layer }); expect(group?.getLayers()).toHaveLength(1) })
  const marker = group!.getLayers()[0] as leaflet.Marker
  const remove = vi.spyOn(map, 'remove')
  view.rerender(<LeafletMap features={[{ ...feature, point: { latitude: 41, longitude: -4 } }]} onSelect={() => {}} />)
  await waitFor(() => expect(marker.getLatLng()).toEqual(leaflet.latLng(41, -4)))
  expect(group!.getLayers()[0]).toBe(marker)
  expect(remove).not.toHaveBeenCalled()
})
