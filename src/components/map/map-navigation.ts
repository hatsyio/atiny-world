import type { Map } from 'leaflet'
import type { GeographicLocation } from '@/domain/location/geographic-location'

type NavigationMap = { [K in 'stop' | 'closePopup' | 'getZoom' | 'flyTo' | 'flyToBounds' | 'setView' | 'fitBounds']: (...args: Parameters<Map[K]>) => ReturnType<Map[K]> } & { on: (event: string, callback: () => void) => unknown; off: (event: string, callback: () => void) => unknown }
export const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function navigateToMessage(map: NavigationMap, point: [number, number], open: () => void, reducedMotion: boolean): () => void {
  map.stop()
  map.closePopup()
  let active = true
  const finish = () => {
    map.off('moveend', finish)
    if (active) { active = false; open() }
  }
  if (reducedMotion) {
    map.setView(point, Math.max(8, map.getZoom()), { animate: false })
    finish()
  } else {
    map.on('moveend', finish)
    map.flyTo(point, Math.max(8, map.getZoom()), { duration: 1.1 })
  }
  return () => { const pending = active; active = false; map.off('moveend', finish); if (pending) map.stop() }
}

export function navigateToLocation(map: NavigationMap, location: Pick<GeographicLocation, 'point' | 'bounds'> & Partial<Pick<GeographicLocation, 'kind' | 'countryCode'>>, reducedMotion: boolean): void {
  map.stop()
  map.closePopup()
  // France's provider bounds span overseas territories across the globe.
  // The filter presents metropolitan France, including Corsica; persistence
  // keeps the provider's full bounds for future territory-specific navigation.
  const viewport = location.kind === 'country' && location.countryCode === 'fr'
    ? { west: -5.5, south: 41, east: 10, north: 51.5 } : location.bounds
  if (viewport) {
    const { west, south, east, north } = viewport
    const bounds: [[number, number], [number, number]] = [[Math.max(-85.05112878, south), west], [Math.min(85.05112878, north), east]]
    const options = { padding: [32, 32] as [number, number], maxZoom: 13, ...(reducedMotion ? { animate: false } : { duration: 1.1 }) }
    if (reducedMotion) map.fitBounds(bounds, options)
    else map.flyToBounds(bounds, options)
  } else {
    const point: [number, number] = [Math.max(-85.05112878, Math.min(85.05112878, location.point.latitude)), location.point.longitude]
    if (reducedMotion) map.setView(point, 11, { animate: false })
    else map.flyTo(point, 11, { duration: 1.1 })
  }
}
