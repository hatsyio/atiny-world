import { describe, expect, it } from 'vitest'
import { createVectorMapStyle, cartoResourceRequest } from '@/components/map/vector-map-style'
import { mapStyle } from '@/config/map-style.config'

describe('editable vector cartography', () => {
  it('changes each feature independently without changing road geometry or zoom rules', () => {
    const style = createVectorMapStyle({ ...mapStyle.colors, water: '#123456', roads: '#abcdef', labels: '#654321' })
    const layer = (id: string) => style.layers.find(layer => layer.id === id)
    // CARTO's translated water_shadow is painted last and covers the ocean.
    expect(layer('water_shadow')?.paint).toMatchObject({ 'fill-color': '#123456' })
    expect(layer('water')?.paint).toMatchObject({ 'fill-color': mapStyle.colors.waterShore })
    expect(layer('waterway')?.paint).toMatchObject({ 'line-color': '#123456' })
    expect(layer('road_minor_fill')?.paint).toMatchObject({ 'line-color': '#abcdef', 'line-width': expect.any(Object) })
    expect(layer('place_city_r5')?.paint).toMatchObject({ 'text-color': '#654321' })
    expect(layer('background')?.paint).toMatchObject({ 'background-color': mapStyle.colors.land })
    expect(layer('building-top')?.paint).toMatchObject({ 'fill-color': mapStyle.colors.buildings, 'fill-outline-color': mapStyle.colors.buildingOutline })
    expect(layer('road_minor_fill')?.minzoom).toBe(15)
  })

  it('keeps water labels on a light halo and land labels on a dark halo', () => {
    const style = createVectorMapStyle({ ...mapStyle.colors, labelHalo: '#111111', waterLabelHalo: '#eeeeee' })
    const paint = (id: string) => style.layers.find(layer => layer.id === id)?.paint
    expect(paint('watername_ocean')).toMatchObject({ 'text-halo-color': '#eeeeee' })
    expect(paint('waterway_label')).toMatchObject({ 'text-halo-color': '#eeeeee' })
    expect(paint('place_country_1')).toMatchObject({ 'text-halo-color': '#111111' })
  })

  it('creates independent styles so edits cannot leak between map instances', () => {
    const first = createVectorMapStyle()
    first.layers.length = 0
    expect(createVectorMapStyle().layers.length).toBeGreaterThan(80)
  })

  it('adds the current key to CARTO style resources, glyphs and tiles only', () => {
    expect(cartoResourceRequest('https://tiles.basemaps.cartocdn.com/vector/1.pbf?x=1', 'a&b').url)
      .toBe('https://tiles.basemaps.cartocdn.com/vector/1.pbf?x=1&key=a%26b')
    expect(cartoResourceRequest('https://tiles.basemaps.cartocdn.com/fonts/a.pbf', 'test').url).toContain('?key=test')
    expect(cartoResourceRequest('https://example.com/a.pbf', 'secret').url).toBe('https://example.com/a.pbf')
    expect(cartoResourceRequest('https://basemaps.cartocdn.com.evil.example/a', 'secret').url).not.toContain('secret')
  })
})
