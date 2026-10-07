/** @vitest-environment jsdom */
import { act, StrictMode } from 'react'
import leaflet from 'leaflet'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, IntlTestProvider } from '../../../support/intl'
import { LocationSelectionMap } from '@/components/map/location-selection-map'

const point = { latitude: 40.4167, longitude: -3.7033 }
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
async function mount(props: Partial<React.ComponentProps<typeof LocationSelectionMap>> = {}) {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const onPointChange = vi.fn()
  const view = render(<LocationSelectionMap point={point} precise={false} onPointChange={onPointChange} {...props} />)
  await waitFor(() => expect(factory).toHaveReturned())
  return { ...view, map: factory.mock.results[0].value as leaflet.Map, onPointChange }
}
it('preserves exploration when focus coordinates are unchanged despite a new object', async () => {
  const { map, rerender, onPointChange } = await mount({ focusPoint: point })
  act(() => { map.setView([41, 4], 9) })
  rerender(<LocationSelectionMap point={point} focusPoint={{ ...point }} precise={false} onPointChange={onPointChange} />)
  expect(map.getCenter().lat).toBeCloseTo(41)
  expect(map.getZoom()).toBe(9)
})
it('uses current callbacks and normalizes wrapped longitude for clicks, dragging and center', async () => {
  const { map, rerender, onPointChange, getByRole } = await mount()
  const next = vi.fn()
  rerender(<LocationSelectionMap point={point} precise onPointChange={next} />)
  act(() => { map.fire('click', { latlng: leaflet.latLng(40, 190) }) })
  expect(next).toHaveBeenLastCalledWith({ latitude: 40, longitude: -170 })
  const marker = Object.values((map as unknown as { _layers: Record<string, leaflet.Layer> })._layers).find(layer => layer instanceof leaflet.Marker) as leaflet.Marker
  act(() => { marker.setLatLng([42, -190]); marker.fire('dragend') })
  expect(next).toHaveBeenLastCalledWith({ latitude: 42, longitude: 170 })
  act(() => { map.setView([43, 200], 10) })
  fireEvent.click(getByRole('button', { name: 'Choose the map center' }))
  expect(next).toHaveBeenLastCalledWith({ latitude: 43, longitude: -160 })
  expect(next).toHaveBeenCalledTimes(3)
  expect(onPointChange).not.toHaveBeenCalled()
})
it('updates and removes the selected marker and focuses a genuinely different point', async () => {
  const { map, rerender, onPointChange, container } = await mount()
  const focus = { latitude: 37.5665, longitude: 126.978 }
  rerender(<LocationSelectionMap point={focus} focusPoint={focus} precise onPointChange={onPointChange} />)
  expect(map.getCenter().lat).toBeCloseTo(focus.latitude)
  expect(map.getZoom()).toBe(14)
  expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1)
  rerender(<LocationSelectionMap precise={false} onPointChange={onPointChange} />)
  expect(container.querySelector('.leaflet-marker-icon')).toBeNull()
})
it('preserves the map while translating zoom controls, marker and center action', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const view = (locale: 'en'|'es') => <IntlTestProvider locale={locale}><LocationSelectionMap point={point} precise onPointChange={() => {}} /></IntlTestProvider>
  const { rerender, container } = render(view('en'))
  await waitFor(() => expect(factory).toHaveReturned())
  const map = factory.mock.results[0].value as leaflet.Map
  const remove = vi.spyOn(map, 'remove')
  act(() => { map.setView([41, 4], 9) })
  rerender(view('es'))
  expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', 'Acercar')
  expect(container.querySelector('.leaflet-marker-icon')).toHaveAttribute('alt', 'Punto público exacto')
  expect(map.getZoom()).toBe(9)
  expect(remove).not.toHaveBeenCalled()
})
it('cleans up its map and listeners with StrictMode', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const onPointChange = vi.fn()
  const { unmount, container } = render(<StrictMode><LocationSelectionMap point={point} precise={false} onPointChange={onPointChange} /></StrictMode>)
  await waitFor(() => expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1))
  const map = factory.mock.results.at(-1)!.value as leaflet.Map
  const remove = vi.spyOn(map, 'remove')
  unmount()
  expect(remove).toHaveBeenCalledOnce()
  act(() => { map.fire('click', { latlng: leaflet.latLng(40, 3) }) })
  expect(onPointChange).not.toHaveBeenCalled()
})

it('starts without a marker and enables navigation while disabling scroll zoom', async () => {
  const { map, container } = await mount({ point: undefined })
  expect(map.getCenter().lat).toBeCloseTo(20)
  expect(map.getZoom()).toBe(2)
  expect(map.dragging.enabled()).toBe(true)
  expect(map.keyboard.enabled()).toBe(true)
  expect(map.scrollWheelZoom.enabled()).toBe(false)
  expect(container.querySelector('.leaflet-marker-icon')).toBeNull()
  expect(container.querySelector('.leaflet-control-zoom')).toBeTruthy()
})
it('shows the configured fallback without a map or center action when tiles are unavailable', () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', '')
  const factory = vi.spyOn(leaflet.Map.prototype, 'setView')
  const { container, queryByRole } = render(<LocationSelectionMap precise={false} onPointChange={() => {}} />)
  expect(container.querySelector('.location-selection-map__unavailable')).toBeVisible()
  expect(queryByRole('button', { name: 'Choose the map center' })).toBeNull()
  expect(factory).not.toHaveBeenCalled()
})
it('contains initialization errors and removes the center action', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(leaflet.Map.prototype, 'setView').mockImplementation(() => { throw new Error('Initialization failed') })
  const { container, queryByRole } = render(<LocationSelectionMap precise={false} onPointChange={() => {}} />)
  await waitFor(() => expect(container.querySelector('.location-selection-map__unavailable')).toBeVisible())
  expect(queryByRole('button', { name: 'Choose the map center' })).toBeNull()
})
