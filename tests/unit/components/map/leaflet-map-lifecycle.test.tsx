/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'
import { act, StrictMode } from 'react'
import leaflet from 'leaflet'
import 'leaflet.markercluster'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { render, IntlTestProvider } from '../../../support/intl'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PublicMapFeature } from '@/domain/messages/public-message'
import { LeafletMap } from '@/components/map/leaflet-map'

const feature: PublicMapFeature = {
  publicId: '11111111-1111-4111-8111-111111111111', point: { latitude: 40, longitude: -3 },
  precision: 'approximate', locality: 'Madrid', country: 'España', countryCode: 'es', publishedAt: '2026-09-25T10:00:00Z',
  author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'Fan' },
}
const second = { ...feature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }
const initialView = { latitude: 40, longitude: -3, zoom: 8 }

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

async function getMap(factory: ReturnType<typeof vi.spyOn>) {
  await waitFor(() => expect(factory).toHaveReturned())
  return factory.mock.results.find((result: { type: string; value: unknown }) => result.type === 'return')!.value as leaflet.Map
}
async function getGroup(map: leaflet.Map, count = 1) {
  let group: leaflet.MarkerClusterGroup | undefined
  await waitFor(() => {
    map.eachLayer(layer => { if (layer instanceof leaflet.MarkerClusterGroup) group = layer })
    expect(group?.getLayers()).toHaveLength(count)
  })
  return group!
}
function clickMarker(marker: leaflet.Marker) {
  act(() => { marker.fire('click', { latlng: marker.getLatLng() }) })
}
function respond(content = 'visible letter') {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ...feature, content })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

it('keeps the map and marker identity, view and current callbacks on feature updates', async () => {
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const first = vi.fn()
  const result = render(<LeafletMap initialView={initialView} features={[]} onSelect={() => {}} onViewportChange={first} />)
  const map = await getMap(factory)
  const setView = vi.spyOn(map, 'setView').mockClear()
  const remove = vi.spyOn(map, 'remove')
  const next = vi.fn()
  result.rerender(<LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}} onViewportChange={next} />)
  const group = await getGroup(map)
  const marker = group.getLayers()[0]
  result.rerender(<LeafletMap initialView={initialView} features={[{ ...feature }]} onSelect={() => {}} onViewportChange={next} />)
  expect(group.getLayers()[0]).toBe(marker)
  act(() => { map.fire('moveend') })
  expect(next).toHaveBeenCalledWith({ west: map.getBounds().getWest(), south: map.getBounds().getSouth(), east: map.getBounds().getEast(), north: map.getBounds().getNorth() })
  expect(first).toHaveBeenCalledTimes(1)
  expect(setView).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it('keeps group and filter panels mutually exclusive and available in fullscreen', async () => {
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const onFiltersChange = vi.fn()
  const result = render(<LeafletMap initialView={initialView} features={[feature, second]} onSelect={() => {}} lang="es"
    filters={{ city: '', country: '' }} onFiltersChange={onFiltersChange} />)
  const map = await getMap(factory)
  const control = await result.findByRole('button', { name: 'Entrar en pantalla completa' })
  const zoom = result.container.querySelector('.leaflet-control-zoom')!
  const fullscreen = control.closest('.leaflet-control-fullscreen')!
  expect(zoom.compareDocumentPosition(fullscreen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(fullscreen).toHaveClass('leaflet-bar')
  fireEvent.click(result.getByRole('button', { name: 'Filtros' }))
  fireEvent.change(result.getByRole('textbox', { name: 'Ciudad' }), { target: { value: 'Madrid' } })
  expect(onFiltersChange).toHaveBeenCalledWith({ city: 'Madrid', country: '' })
  fireEvent.click(result.getByRole('button', { name: /Ver 2 mensajes/ }))
  expect(result.container.querySelector('.map-filters')).toBeNull()
  expect(result.container.querySelector('#map-cluster-list')).toBeTruthy()
  fireEvent.click(result.getByRole('button', { name: 'Filtros' }))
  expect(result.container.querySelector('#map-cluster-list')).toBeNull()
  const invalidate = vi.spyOn(map, 'invalidateSize')
  fireEvent.click(control)
  expect(control).toHaveAccessibleName('Salir de pantalla completa')
  expect(control).toHaveAttribute('aria-pressed', 'true')
  expect(result.container.querySelector('.map--fullscreen .map-filters')).toBeTruthy()
  await waitFor(() => expect(invalidate).toHaveBeenCalled())
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(control).toHaveAccessibleName('Entrar en pantalla completa')
})

it('loads safe text into one popup, preserves it on equivalent features and uses the latest read callback', async () => {
  const content = 'Gracias\nSiempre contigo <script>alert(1)</script>'
  const fetch = respond(content)
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const oldSelect = vi.fn()
  const result = render(<LeafletMap initialView={initialView} features={[feature]} onSelect={oldSelect} lang="es" />)
  const map = await getMap(factory)
  const group = await getGroup(map)
  const marker = group.getLayers()[0] as leaflet.Marker
  expect(fetch).not.toHaveBeenCalled()
  clickMarker(marker)
  expect(await result.findByText((_, element) => element?.tagName === 'P' && element.textContent === content)).toBeInTheDocument()
  expect(result.container.querySelector('script')).toBeNull()
  expect(result.container.querySelectorAll('.leaflet-popup')).toHaveLength(1)
  expect(marker.getPopup()?.options).toMatchObject({ autoClose: true, closeOnClick: true })
  expect(fetch).toHaveBeenCalledWith(`/api/messages/${feature.publicId}`, expect.objectContaining({ cache: 'no-store' }))
  const select = vi.fn()
  result.rerender(<LeafletMap initialView={initialView} features={[{ ...feature }]} onSelect={select} lang="es" />)
  expect(marker.isPopupOpen()).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(result.getByRole('button', { name: 'Leer completo' }))
  expect(select).toHaveBeenCalledWith(feature.publicId)
  expect(oldSelect).not.toHaveBeenCalled()
  expect(leaflet.Icon.Default.imagePath).toBe('/images/leaflet/')
})

it('reports the saved center and zoom and later moves without rebuilding the map', async () => {
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const onViewChange = vi.fn()
  render(<LeafletMap initialView={initialView} features={[]} onSelect={() => {}} onViewChange={onViewChange} />)
  const map = await getMap(factory)
  await waitFor(() => expect(onViewChange).toHaveBeenCalledWith(initialView))
  act(() => { map.setView([41, -4], 9) })
  expect(onViewChange).toHaveBeenLastCalledWith({ latitude: 41, longitude: -4, zoom: 9 })
})

it('translates controls and an open popup without losing the map, view or filters', async () => {
  respond()
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const view = (locale: 'en' | 'es') => <IntlTestProvider locale={locale}><LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}}
    filters={{ city: '서울', country: 'kr' }} onFiltersChange={() => {}} /></IntlTestProvider>
  const result = render(view('en'))
  const map = await getMap(factory)
  const marker = (await getGroup(map)).getLayers()[0] as leaflet.Marker
  clickMarker(marker)
  await result.findByRole('button', { name: 'Read full message' })
  fireEvent.click(result.getByRole('button', { name: 'Filters (2)' }))
  const setView = vi.spyOn(map, 'setView').mockClear()
  const remove = vi.spyOn(map, 'remove')
  const canvas = result.container.querySelector('.map__canvas')
  result.rerender(view('es'))
  expect(result.getByRole('textbox', { name: 'Ciudad' })).toHaveValue('서울')
  expect(result.getByRole('combobox', { name: 'País' })).toHaveValue('kr')
  expect(result.getByRole('button', { name: 'Entrar en pantalla completa' })).toHaveAttribute('title', 'Entrar en pantalla completa')
  expect(result.getByRole('button', { name: 'Acercar' })).toBeTruthy()
  expect(result.getByRole('button', { name: 'Leer completo' })).toBeTruthy()
  expect(result.getByRole('button', { name: 'Cerrar ventana' })).toBeTruthy()
  expect(result.container.querySelector('.map__canvas')).toBe(canvas)
  expect(marker.isPopupOpen()).toBe(true)
  expect(setView).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it('hides a letter which is no longer public when its open query is revalidated', async () => {
  let hidden = false
  vi.stubGlobal('fetch', vi.fn(async () => hidden ? new Response(null, { status: 404 }) : new Response(JSON.stringify({ ...feature, content: 'visible letter' }))))
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const client = new QueryClient()
  const result = render(<QueryClientProvider client={client}><LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}} /></QueryClientProvider>)
  const map = await getMap(factory)
  clickMarker((await getGroup(map)).getLayers()[0] as leaflet.Marker)
  await result.findByText('visible letter')
  hidden = true
  await act(async () => { await client.resetQueries({ queryKey: publicMapQueryKey }) })
  await result.findByText('The message could not be loaded.')
  expect(result.queryByText('visible letter')).toBeNull()
  client.clear()
})

it.each(['remove', 'close', 'unmount'] as const)('cancels a pending popup request on %s', async action => {
  const signals: AbortSignal[] = []
  vi.stubGlobal('fetch', vi.fn((_url: unknown, init?: RequestInit) => { signals.push(init?.signal as AbortSignal); return new Promise<Response>(() => {}) }))
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const result = render(<LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}} />)
  const map = await getMap(factory)
  const group = await getGroup(map)
  const marker = group.getLayers()[0] as leaflet.Marker
  clickMarker(marker)
  await waitFor(() => expect(signals).toHaveLength(1))
  if (action === 'remove') result.rerender(<LeafletMap initialView={initialView} features={[]} onSelect={() => {}} />)
  else if (action === 'close') clickMarker(marker)
  else result.unmount()
  await waitFor(() => expect(signals[0].aborted).toBe(true))
  expect(signals).toHaveLength(1)
  if (action === 'remove') { expect(group.getLayers()).toHaveLength(0); expect(result.container.querySelector('.leaflet-popup')).toBeNull() }
})

it('clusters nearby markers and updates the count when a letter is withdrawn', async () => {
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const result = render(<LeafletMap initialView={initialView} features={[feature, second]} onSelect={() => {}} />)
  const map = await getMap(factory)
  const group = await getGroup(map, 2)
  const marker = group.getLayers()[0] as leaflet.Marker
  const parent = group.getVisibleParent(marker) as leaflet.MarkerCluster
  expect(parent.getChildCount()).toBe(2)
  expect(parent.getElement()).toHaveClass('map-message-cluster')
  expect(parent.getElement()).toHaveTextContent('2')
  result.rerender(<LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}} />)
  await waitFor(() => expect(group.getLayers()).toHaveLength(1))
  expect(group.getVisibleParent(marker)).toBe(marker)
})

it('reveals a selected letter inside a cluster and does not recenter on equivalent updates', async () => {
  respond()
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const result = render(<LeafletMap initialView={initialView} features={[feature, second]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  const map = await getMap(factory)
  const group = await getGroup(map, 2)
  await result.findByText('visible letter')
  expect((group.getLayers()[0] as leaflet.Marker).isPopupOpen()).toBe(true)
  const setView = vi.spyOn(map, 'setView').mockClear()
  result.rerender(<LeafletMap initialView={initialView} features={[{ ...feature }, second]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  expect(setView).not.toHaveBeenCalled()
})

it('cleans up a StrictMode map and its query observers on unmount', async () => {
  respond()
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const result = render(<StrictMode><LeafletMap initialView={initialView} features={[feature]} onSelect={() => {}} /></StrictMode>)
  const map = await getMap(factory)
  const group = await getGroup(map)
  const remove = vi.spyOn(map, 'remove')
  result.unmount()
  expect(remove).toHaveBeenCalledOnce()
  expect(group.getLayers()).toHaveLength(0)
})

it('renders a world preview when the basemap is not configured', () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', '')
  const result = render(<LeafletMap features={[]} onSelect={() => {}} />)
  expect(result.getByRole('img', { name: 'World map' })).toBeTruthy()
  expect(result.getByRole('status')).toHaveTextContent('The interactive map is coming soon.')
})

it('cancels a pending cluster reveal when the selected letter is withdrawn', async () => {
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const result = render(<LeafletMap initialView={initialView} features={[feature, second]} onSelect={() => {}} />)
  const map = await getMap(factory)
  const group = await getGroup(map, 2)
  const marker = group.getLayers()[0] as leaflet.Marker
  // Keep the reveal pending, like an in-flight zoom/spiderfy animation in the browser.
  const zoom = vi.spyOn(leaflet.MarkerCluster.prototype, 'zoomToBounds').mockImplementation(() => {})
  vi.spyOn(leaflet.MarkerCluster.prototype, 'spiderfy').mockImplementation(function (this: leaflet.MarkerCluster) { return this })
  result.rerender(<LeafletMap initialView={initialView} features={[feature, second]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  await waitFor(() => expect(zoom).toHaveBeenCalled())
  result.rerender(<LeafletMap initialView={initialView} features={[second]} selectedPublicId={feature.publicId} onSelect={() => {}} />)
  expect(() => act(() => { map.fire('moveend'); group.fire('animationend'); group.fire('spiderfied') })).not.toThrow()
  expect(marker.isPopupOpen()).toBe(false)
})
