'use client'

import dynamic from 'next/dynamic'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'
import type { MapFilterValues } from './map-filters'

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
  lang?: 'en' | 'es'
  onViewportChange?: (bounds: MapBounds) => void
  filters?: MapFilterValues
  onFiltersChange?: (values: MapFilterValues) => void
  groupRequestUrl?: string
  selectedPublicId?: string
}

export function PublicMapLoader({ features, onSelect, lang, onViewportChange, filters, onFiltersChange, groupRequestUrl, selectedPublicId }: Props) {
  return <LeafletMap features={features} onSelect={onSelect} lang={lang} onViewportChange={onViewportChange} filters={filters} onFiltersChange={onFiltersChange} groupRequestUrl={groupRequestUrl} selectedPublicId={selectedPublicId} />
}
