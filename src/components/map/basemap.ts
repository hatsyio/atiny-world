export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function cartoTileUrl(apiKey: string): string {
  return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(apiKey)}`
}

export function configureMarkerIcons(leaflet: typeof import('leaflet')): void {
  leaflet.Icon.Default.imagePath = '/images/leaflet/'
}

export function createMessageIcon(leaflet: typeof import('leaflet')): import('leaflet').DivIcon {
  return leaflet.divIcon({
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
    className: 'map-message-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}
