'use client'

import { createElementObject, createLayerComponent, extendContext } from '@react-leaflet/core'
import type { PropsWithChildren } from 'react'
import type { LayerProps } from '@react-leaflet/core'
import leaflet from 'leaflet'
import 'leaflet.markercluster'

// The existing plugin owns clustering; React Leaflet owns adding/removing its child markers.
export const MarkerCluster = createLayerComponent<leaflet.MarkerClusterGroup, PropsWithChildren<LayerProps>>((_props, context) => {
  const group = leaflet.markerClusterGroup({
    iconCreateFunction: cluster => {
      const count = cluster.getChildCount()
      const size = count < 10 ? 36 : count < 100 ? 40 : 44
      return leaflet.divIcon({ html: `<span>${count}</span>`, className: 'map-message-cluster', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
    },
  })
  return createElementObject(group, extendContext(context, { layerContainer: group }))
})
