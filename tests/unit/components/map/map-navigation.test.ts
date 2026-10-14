import { expect, it, vi } from 'vitest'
import { navigateToLocation, navigateToMessage } from '@/components/map/map-navigation'
function fakeMap() {
  const listeners = new Set<() => void>()
  return { stop: vi.fn(), closePopup: vi.fn(), getZoom: () => 3, flyTo: vi.fn(), flyToBounds: vi.fn(), setView: vi.fn(), fitBounds: vi.fn(), on: (_: string, fn: () => void) => { listeners.add(fn) }, off: (_: string, fn: () => void) => { listeners.delete(fn) }, finish: () => [...listeners].forEach(fn => fn()) }
}
it('flies to a message and opens its preview only after moveend', () => {
  const map = fakeMap(), open = vi.fn()
  const cancel = navigateToMessage(map, [40, -3], open, false)
  expect(map.flyTo).toHaveBeenCalledWith([40, -3], 8, expect.any(Object))
  expect(open).not.toHaveBeenCalled()
  map.finish()
  expect(open).toHaveBeenCalledTimes(1)
  cancel()
})
it('cancels obsolete previews before starting another flight', () => {
  const map = fakeMap(), old = vi.fn(), next = vi.fn()
  navigateToMessage(map, [40, -3], old, false)()
  navigateToMessage(map, [41, -4], next, false)
  map.finish()
  expect(old).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
})
it('frames bounds with padding and falls back to a defined city zoom with reduced motion', () => {
  const map = fakeMap()
  navigateToLocation(map, { point: { latitude: 40, longitude: -3 }, bounds: { west: -4, south: 39, east: -2, north: 41 } }, false)
  expect(map.flyToBounds).toHaveBeenCalledWith([[39, -4], [41, -2]], expect.objectContaining({ padding: [32, 32] }))
  navigateToLocation(map, { point: { latitude: 40, longitude: -3 }, bounds: null }, true)
  expect(map.setView).toHaveBeenCalledWith([40, -3], 11, { animate: false })
})
it('opens a message without animation when reduced motion is requested', () => {
  const map = fakeMap(), open = vi.fn()
  navigateToMessage(map, [40, -3], open, true)
  expect(map.flyTo).not.toHaveBeenCalled()
  expect(open).toHaveBeenCalledTimes(1)
})

it('frames metropolitan France including Corsica instead of its worldwide overseas bounds', () => {
  const map = fakeMap()
  navigateToLocation(map, { kind: 'country', countryCode: 'fr', point: { latitude: 46.6, longitude: 1.9 }, bounds: { west: -178.4, south: -50.3, east: 172.4, north: 51.4 } }, false)
  expect(map.flyToBounds).toHaveBeenCalledWith([[41, -5.5], [51.5, 10]], expect.objectContaining({ padding: [32, 32] }))
})
