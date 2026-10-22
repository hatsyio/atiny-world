import type { StyleSpecification } from 'maplibre-gl'
import { mapStyle, type MapColors } from '@/config/map-style.config'

export const CARTO_VECTOR_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

/** Retain CARTO's geometry, label placement and zoom hierarchy; replace paint only. */
export function createVectorMapStyle(voyager: StyleSpecification, colors: MapColors = mapStyle.colors): StyleSpecification {
  const style = structuredClone(voyager)
  for (const layer of style.layers) {
    const source = 'source-layer' in layer ? layer['source-layer'] : undefined
    if (layer.type === 'background') layer.paint = { ...layer.paint, 'background-color': colors.land }
    if (layer.type === 'fill') {
      // Voyager paints the translated water_shadow last; it must carry the main sea color.
      const color = source === 'water' ? (layer.id === 'water_shadow' ? colors.water : colors.waterShore)
        : source === 'buildings' ? colors.buildings
          : layer.id === 'landuse_residential' ? colors.residential : colors.vegetation
      layer.paint = { ...layer.paint, 'fill-color': color }
      if (source === 'buildings') layer.paint['fill-outline-color'] = colors.buildingOutline
    }
    if (layer.type === 'line') {
      const color = source === 'water' ? colors.water
        : source === 'boundaries' ? (layer.id.endsWith('_outline') ? colors.land : colors.boundaries)
          : layer.id.includes('rail') ? (layer.id.endsWith('_dash') ? colors.roads : colors.railways)
            : layer.id.includes('path') ? colors.paths
              : layer.id.includes('_case') ? colors.roadOutline
                : /_(mot|trunk|pri|sec)_/.test(layer.id) ? colors.majorRoads : colors.roads
      layer.paint = { ...layer.paint, 'line-color': color }
    }
    if (layer.type === 'symbol') {
      const waterLabel = source === 'water' || layer.id.startsWith('watername_')
      layer.paint = { ...layer.paint, 'text-color': waterLabel ? colors.waterLabels : colors.labels,
        'text-halo-color': waterLabel ? colors.waterLabelHalo : colors.labelHalo }
      if (layer.paint['icon-color']) layer.paint['icon-color'] = colors.labels
    }
  }
  return style
}

/** Never forward the public CARTO key to unrelated hosts. Also covers TileJSON tile URLs. */
export function cartoResourceRequest(resource: string, apiKey: string): { url: string } {
  const url = new URL(resource)
  if (url.protocol === 'https:' && (url.hostname === 'basemaps.cartocdn.com' || url.hostname.endsWith('.basemaps.cartocdn.com'))) {
    url.searchParams.set('key', apiKey)
  }
  return { url: url.toString() }
}
