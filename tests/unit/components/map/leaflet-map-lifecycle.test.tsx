/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, fireEvent,  waitFor } from '@testing-library/react'
import { render, IntlTestProvider } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicMapFeature } from '@/domain/messages/public-message'
import { LeafletMap } from '@/components/map/leaflet-map'

const leaflet = vi.hoisted(() => {
  let fullscreenControlContainer: HTMLElement | null = null
  const zoomControlContainer = document.createElement('div')
  zoomControlContainer.className = 'leaflet-bar leaflet-control-zoom'
  const bounds = { getWest: () => -10, getSouth: () => -5, getEast: () => 10, getNorth: () => 5 }
  const instance = {
    setView: vi.fn().mockReturnThis(),
    addLayer: vi.fn(),
    addControl: vi.fn((control: { onAdd: (map: typeof instance) => HTMLElement }) => {
      fullscreenControlContainer = control.onAdd(instance)
    }),
    removeLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getBounds: vi.fn(() => bounds),
    getCenter: vi.fn(() => ({ lat: 40.5, lng: -3.5 })),
    getZoom: vi.fn(() => 8),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
    zoomControl: { getContainer: vi.fn(() => zoomControlContainer) },
  }
  const cluster = { addLayer: vi.fn(), removeLayer: vi.fn(), clearLayers: vi.fn() }
  const markerHandlers = new Map<string, () => void>()
  const markerInstance = {
    bindPopup: vi.fn(),
    setPopupContent: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => { markerHandlers.set(event, handler) }),
    openPopup: vi.fn(),
  }
  return {
    instance,
    cluster,
    markerHandlers,
    markerInstance,
    map: vi.fn(() => instance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    markerClusterGroup: vi.fn(() => cluster),
    marker: vi.fn(() => markerInstance),
    Icon: { Default: { imagePath: undefined as string | undefined } },
    Control: class {
      onAdd = () => document.createElement('div')
      constructor(readonly options: { position: string }) {}
    },
    getFullscreenControlContainer: () => fullscreenControlContainer,
    resetFullscreenControlContainer: () => { fullscreenControlContainer = null },
  }
})

vi.mock('leaflet', () => ({ ...leaflet, default: leaflet }))
vi.mock('leaflet.markercluster', () => ({}))

const feature: PublicMapFeature = {
  publicId: '11111111-1111-4111-8111-111111111111',
  point: { latitude: 40, longitude: -3 },
  precision: 'approximate',
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  publishedAt: '2026-09-25T10:00:00Z',
  author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'Fan' },
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  leaflet.instance.zoomControl.getContainer().replaceChildren()
  leaflet.resetFullscreenControlContainer()
  leaflet.markerHandlers.clear()
})

describe('LeafletMap lifecycle', () => {
  it('keeps the map instance and zoom when features or viewport callback change', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const onViewportChange = vi.fn()
    const { rerender } = render(<LeafletMap features={[]} onSelect={() => {}} onViewportChange={onViewportChange} />)
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1))

    const nextViewportChange = vi.fn()
    rerender(<LeafletMap features={[feature]} onSelect={() => {}} onViewportChange={nextViewportChange} />)
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(1))

    expect(leaflet.map).toHaveBeenCalledTimes(1)
    expect(leaflet.instance.remove).not.toHaveBeenCalled()
    expect(leaflet.instance.setView).toHaveBeenCalledTimes(1)
  })

  it('adds an accessible fullscreen control below the zoom controls', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const { container, queryByRole } = render(<LeafletMap features={[feature, { ...feature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }]} onSelect={() => {}} />)
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1))

    const fullscreenControlContainer = leaflet.getFullscreenControlContainer()
    const control = fullscreenControlContainer?.querySelector<HTMLButtonElement>('.leaflet-control-zoom-fullscreen')
    if (!control) throw new Error('fullscreen control unavailable')

    expect(control).toHaveClass('leaflet-control-zoom-fullscreen')
    expect(fullscreenControlContainer).toHaveClass('leaflet-control-fullscreen', 'leaflet-bar')
    expect(fullscreenControlContainer).not.toBe(leaflet.instance.zoomControl.getContainer())
    expect(leaflet.instance.addControl).toHaveBeenCalledTimes(1)
    expect(control).toHaveAccessibleName('Enter fullscreen')
    expect(control.title).toBe('Enter fullscreen')
    const groupButton = queryByRole('button', { name: /view \d+ messages/i })
    if (!groupButton) throw new Error('group control unavailable')
    const canvas = container.querySelector('.map__canvas')
    if (!canvas) throw new Error('map canvas unavailable')
    expect(canvas?.compareDocumentPosition(groupButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(groupButton.closest('.map__overlay')).toBeTruthy()
    fireEvent.click(groupButton)
    const panel = container.querySelector('#map-cluster-list')
    expect(panel).toBeTruthy()
    expect(panel?.closest('.map__overlay')).toBeTruthy()

    fireEvent.click(control)
    await waitFor(() => expect(control).toHaveAccessibleName('Exit fullscreen'))
    expect(leaflet.instance.invalidateSize).toHaveBeenCalled()
    expect(container.querySelector('section')).toHaveClass('map--fullscreen')
    expect(queryByRole('button', { name: /view \d+ messages/i })).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('.map--fullscreen #map-cluster-list')).toBeTruthy()

    fireEvent.click(groupButton)
    expect(container.querySelector('#map-cluster-list')).toBeNull()
    fireEvent.click(groupButton)
    expect(container.querySelector('.map--fullscreen #map-cluster-list')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(control).toHaveAccessibleName('Enter fullscreen'))
  })

  it('opens the city and country filters inside the map and preserves them in fullscreen', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const onFiltersChange = vi.fn()
    const { container, getByRole } = render(
      <LeafletMap
        features={[feature, { ...feature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }]}
        onSelect={() => {}}
        lang="es"
        filters={{ city: '', country: '' }}
        onFiltersChange={onFiltersChange}
      />,
    )
    await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1))

    const toggle = getByRole('button', { name: 'Filtros' })
    expect(toggle.closest('.map')).toBeTruthy()
    expect(container.querySelector('.map-filters')).toBeNull()
    fireEvent.click(toggle)
    expect(getByRole('textbox', { name: 'Ciudad' })).toBeVisible()
    expect(getByRole('combobox', { name: 'País' })).toBeVisible()
    fireEvent.change(getByRole('textbox', { name: 'Ciudad' }), { target: { value: 'Madrid' } })
    expect(onFiltersChange).toHaveBeenCalledWith({ city: 'Madrid', country: '' })

    fireEvent.click(getByRole('button', { name: /Ver \d+ mensajes/ }))
    expect(container.querySelector('.map-filters')).toBeNull()
    expect(container.querySelector('#map-cluster-list')).toBeTruthy()
    fireEvent.click(toggle)
    expect(container.querySelector('#map-cluster-list')).toBeNull()

    const fullscreenControl = leaflet.getFullscreenControlContainer()?.querySelector<HTMLButtonElement>('button')
    if (!fullscreenControl) throw new Error('fullscreen control unavailable')
    fireEvent.click(fullscreenControl)
    expect(container.querySelector('.map--fullscreen .map-filters')).toBeTruthy()
  })

  it('uses the bundled marker images from a stable public path', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    leaflet.Icon.Default.imagePath = undefined
    render(<LeafletMap features={[feature]} onSelect={() => {}} />)
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(1))

    expect(leaflet.Icon.Default.imagePath).toBe('/images/leaflet/')
  })

  it('shows the letter in a persistent popup without navigating', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({
      ...feature,
      content: 'Gracias por estar aquí\nSiempre contigo <script>alert(1)</script>',
    })))
    vi.stubGlobal('fetch', fetch)
    const onSelect = vi.fn()
    const { rerender } = render(<LeafletMap features={[feature]} onSelect={onSelect} lang="es" />)
    await waitFor(() => expect(leaflet.markerHandlers.has('click')).toBe(true))

    act(() => leaflet.markerHandlers.get('click')?.())
    await waitFor(() => expect(leaflet.markerInstance.setPopupContent).toHaveBeenCalled())

    expect(fetch).toHaveBeenCalledWith(`/api/messages/${feature.publicId}`, expect.objectContaining({ cache: 'no-store' }))
    expect(onSelect).not.toHaveBeenCalled()
    const popup = leaflet.markerInstance.setPopupContent.mock.calls.at(-1)?.[0] as HTMLElement
    expect(popup.textContent).toBe('Gracias por estar aquí\nSiempre contigo <script>alert(1)</script>')
    expect(popup.querySelector('script')).toBeNull()
    expect(leaflet.markerInstance.bindPopup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ autoClose: false, closeOnClick: false }),
    )

    rerender(<LeafletMap features={[{ ...feature }]} onSelect={onSelect} lang="es" />)
    await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(1))
    expect(leaflet.cluster.removeLayer).not.toHaveBeenCalled()
  })
})


it('initializes the restored map at the saved center and zoom and reports subsequent moves', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const onViewChange = vi.fn()
  render(<LeafletMap features={[]} onSelect={() => {}} initialView={{ latitude: 40.5, longitude: -3.5, zoom: 8 }} onViewChange={onViewChange} />)
  await waitFor(() => expect(leaflet.map).toHaveBeenCalledTimes(1))
  expect(leaflet.instance.setView).toHaveBeenCalledWith([40.5, -3.5], 8)
  expect(onViewChange).toHaveBeenCalledWith({ latitude: 40.5, longitude: -3.5, zoom: 8 })
})

it('updates locale controls without recreating the map, markers, view or open filters', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const features = [feature]
  const view = (locale: 'en' | 'es') => <IntlTestProvider locale={locale}><LeafletMap features={features} onSelect={() => {}} filters={{city:'서울',country:'kr'}} onFiltersChange={() => {}} /></IntlTestProvider>
  const result = render(view('en'))
  await waitFor(() => expect(leaflet.marker).toHaveBeenCalledTimes(1))
  fireEvent.click(result.getByRole('button', {name:'Filters (2)'}))
  const canvas = result.container.querySelector('.map__canvas')
  const control = leaflet.getFullscreenControlContainer()?.querySelector('button')
  result.rerender(view('es'))
  expect(result.getByRole('textbox', {name:'Ciudad'})).toHaveValue('서울')
  expect(result.getByRole('combobox', {name:'País'})).toHaveValue('kr')
  expect(control).toHaveAccessibleName('Entrar en pantalla completa')
  expect(result.container.querySelector('.map__canvas')).toBe(canvas)
  expect(leaflet.map).toHaveBeenCalledTimes(1)
  expect(leaflet.marker).toHaveBeenCalledTimes(1)
  expect(leaflet.instance.setView).toHaveBeenCalledTimes(1)
  expect(leaflet.instance.remove).not.toHaveBeenCalled()
})
