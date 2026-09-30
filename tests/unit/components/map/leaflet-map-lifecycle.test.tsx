/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
    expect(control).toHaveAccessibleName('Entrar en pantalla completa')
    expect(control.title).toBe('Entrar en pantalla completa')
    const groupButton = queryByRole('button', { name: /ver mensajes del grupo/i })
    if (!groupButton) throw new Error('group control unavailable')
    fireEvent.click(groupButton)
    expect(container.querySelector('#map-cluster-list')).toBeTruthy()

    fireEvent.click(control)
    await waitFor(() => expect(control).toHaveAccessibleName('Salir de pantalla completa'))
    expect(leaflet.instance.invalidateSize).toHaveBeenCalled()
    expect(container.querySelector('section')).toHaveClass('map--fullscreen')
    expect(queryByRole('button', { name: /ver mensajes del grupo/i })).toBeNull()
    expect(container.querySelector('#map-cluster-list')).toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(control).toHaveAccessibleName('Entrar en pantalla completa'))
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
