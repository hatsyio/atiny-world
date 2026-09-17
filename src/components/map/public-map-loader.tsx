'use client'

import dynamic from 'next/dynamic'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'

const LeafletMap = dynamic(
  () => import('./leaflet-map').then((module) => module.LeafletMap),
  {
    ssr: false,
    loading: () => <p role="status">Cargando mapa…</p>,
  },
)

interface Props {
  features: PublicMapFeature[]
  onSelect: (publicId: string) => void
  onViewportChange?: (bounds: MapBounds) => void
  groupRequestUrl?: string
  selectedPublicId?: string
}

export function PublicMapLoader({ features, onSelect, onViewportChange, groupRequestUrl, selectedPublicId }: Props) {
  return <LeafletMap features={features} onSelect={onSelect} onViewportChange={onViewportChange} groupRequestUrl={groupRequestUrl} selectedPublicId={selectedPublicId} />
}
