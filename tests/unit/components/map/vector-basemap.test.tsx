/** @vitest-environment jsdom */
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import leaflet from 'leaflet'
import { MapContainer } from 'react-leaflet'
import { render } from '../../../support/intl'
import { VectorBasemap } from '@/components/map/vector-basemap'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('keeps raster cartography and attribution usable when WebGL is unavailable', async () => {
  const view = render(<MapContainer center={[41.4, 2.1]} zoom={12}><VectorBasemap apiKey="test&key" /></MapContainer>)
  await waitFor(() => expect(view.container.querySelector('.leaflet-tile')?.getAttribute('src')).toContain('key=test%26key'))
  expect(view.container.querySelector('.leaflet-control-attribution')).toHaveTextContent('CARTO')
  expect(view.container.querySelector('.leaflet-control-attribution')).toHaveTextContent('OpenMapTiles')
  view.unmount()
  expect(document.querySelector('.leaflet-tile')).toBeNull()
})

it('removes a partially initialised vector layer when the GPU constructor fails', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce({ getExtension: () => null } as never).mockReturnValue(null)
  const layersAdded = vi.spyOn(leaflet.Map.prototype, 'addLayer')
  let map: leaflet.Map | null = null
  const view = render(<MapContainer ref={value => { map = value }} center={[41.4, 2.1]} zoom={12}><VectorBasemap apiKey="test" /></MapContainer>)
  await waitFor(() => expect(map).not.toBeNull())
  // Exercise the real adapter and renderer, with an unavailable GPU after the probe.
  await waitFor(() => expect(layersAdded.mock.calls.some(([layer]) => 'getMaplibreMap' in layer)).toBe(true))
  await waitFor(() => {
    const layers: leaflet.Layer[] = []
    map!.eachLayer(layer => { layers.push(layer) })
    expect(layers).toHaveLength(1)
    expect(layers[0]).toBeInstanceOf(leaflet.TileLayer)
  })
  expect(view.container.querySelector('.leaflet-gl-layer')).toBeNull()
  expect(() => view.unmount()).not.toThrow()
})
