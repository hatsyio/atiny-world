/** @vitest-environment jsdom */
import leaflet from 'leaflet'
import 'leaflet.markercluster'
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { LeafletMap } from '@/components/map/leaflet-map'
import type { PublicMapFeature } from '@/domain/messages/public-message'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('keeps the located letter open when nearby markers arrive and cluster', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...feature, content: 'Located letter content' }))))
  const feature: PublicMapFeature = {
    publicId: '11111111-1111-4111-8111-111111111111', point: { latitude: 40, longitude: -3 },
    precision: 'approximate', locality: 'Madrid', country: 'España', countryCode: 'es',
    publishedAt: '2026-10-01T10:00:00Z', author: { publicId: 'author', displayName: 'ATINY' },
  }
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const page = render(<LeafletMap features={[feature]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  await waitFor(() => expect(page.getByText('Located letter content')).toBeVisible())
  const map = factory.mock.results[0].value as leaflet.Map
  const neighbors = [2, 3].map(index => ({ ...feature, publicId: `neighbor-${index}` }))
  page.rerender(<LeafletMap features={[feature, ...neighbors]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  await waitFor(() => expect(page.getByText('Located letter content')).toBeVisible())
  let group: leaflet.MarkerClusterGroup | undefined
  map.eachLayer(layer => { if (layer instanceof leaflet.MarkerClusterGroup) group = layer })
  expect(group!.getLayers()).toHaveLength(2)
  const parent = group!.getVisibleParent(group!.getLayers()[0] as leaflet.Marker) as leaflet.MarkerCluster
  expect(parent.getChildCount()).toBe(2)
  // The selected point remains independently reachable when the cluster refreshes.
  let selected: leaflet.Marker | undefined
  map.eachLayer(layer => { if (layer instanceof leaflet.Marker && layer.getPopup()?.isOpen()) selected = layer })
  expect(selected?.getLatLng()).toEqual(leaflet.latLng(feature.point.latitude, feature.point.longitude))
})
