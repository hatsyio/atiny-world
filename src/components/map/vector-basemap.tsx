'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import leaflet from 'leaflet'
import type { Map as VectorMap } from 'maplibre-gl'
import type { MaplibreGL } from '@maplibre/maplibre-gl-leaflet'
import { CARTO_ATTRIBUTION, cartoTileUrl } from './basemap'
import { CARTO_VECTOR_STYLE_URL, cartoResourceRequest, createVectorMapStyle } from './vector-map-style'

export const VECTOR_ATTRIBUTION = CARTO_ATTRIBUTION

/** Leaflet keeps ownership of navigation, markers and controls; GL draws only the background. */
export function VectorBasemap({ apiKey, attribution = VECTOR_ATTRIBUTION }: { apiKey: string; attribution?: string }) {
  const map = useMap()
  useEffect(() => {
    let disposed = false
    let failed = false
    let vector: InstanceType<typeof MaplibreGL> | undefined
    let renderer: VectorMap | undefined
    let canvas: HTMLCanvasElement | undefined
    let timeout: number | undefined
    let failureTimer: number | undefined
    const raster = leaflet.tileLayer(cartoTileUrl(apiKey), { maxZoom: 19 }).addTo(map)
    map.attributionControl?.addAttribution(attribution)

    const fallback = () => {
      if (disposed || failed) return
      failed = true
      window.clearTimeout(timeout)
      // Avoid destroying the renderer inside its own error/render callback.
      failureTimer = window.setTimeout(() => {
        if (disposed) return
        raster.addTo(map)
        vector?.remove()
      }, 0)
    }
    const loaded = () => {
      if (disposed || failed || !vector) return
      window.clearTimeout(timeout)
      vector.getContainer().style.opacity = '1'
      raster.remove()
    }

    // Headless and older browsers retain the raster layer without downloading GL.
    if (typeof window.WebGL2RenderingContext !== 'undefined') {
      const probe = document.createElement('canvas').getContext('webgl2')
      if (probe) {
        probe.getExtension('WEBGL_lose_context')?.loseContext()
        timeout = window.setTimeout(fallback, 15_000)
        void Promise.all([import('@maplibre/maplibre-gl-leaflet'), import('maplibre-gl')]).then(([adapter, gl]) => {
          if (disposed || failed) return
          gl.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href)
          // The adapter registers with Leaflet before creating GL. Its default
          // onRemove assumes construction succeeded, which is false on GPU errors.
          class VectorLayer extends adapter.MaplibreGL {
            onRemove(owner: leaflet.Map): this {
              if (this.getMaplibreMap()) super.onRemove(owner)
              else this.getContainer()?.remove()
              return this
            }
          }
          vector = new VectorLayer({ attributionControl: false,
            transformRequest: resource => cartoResourceRequest(resource, apiKey) })
          vector.addTo(map)
          vector.getContainer().style.opacity = '0'
          renderer = vector.getMaplibreMap()
          renderer.on('load', loaded)
          renderer.on('error', fallback)
          canvas = vector.getCanvas()
          canvas.addEventListener('webglcontextlost', fallback)
          // CARTO's style resolves the current release of tiles, fonts and sprites together.
          renderer.setStyle(CARTO_VECTOR_STYLE_URL, {
            transformStyle: (_previous, next) => createVectorMapStyle(next),
          })
        }).catch(fallback)
      }
    }
    return () => {
      disposed = true
      window.clearTimeout(timeout)
      window.clearTimeout(failureTimer)
      canvas?.removeEventListener('webglcontextlost', fallback)
      renderer?.off('load', loaded)
      renderer?.off('error', fallback)
      vector?.remove()
      raster.remove()
      map.attributionControl?.removeAttribution(attribution)
    }
  }, [map, apiKey, attribution])
  return null
}
