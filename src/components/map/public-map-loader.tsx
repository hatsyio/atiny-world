'use client'

import type { Locale } from '@/i18n/locale'

import { useTranslations } from 'next-intl'

import dynamic from 'next/dynamic'

import type { MapBounds, PublicMapFeature } from '@/domain/messages/public-message'
import type { MapView } from '@/components/navigation/letter-origin'
import type { MapFilterValues } from './map-filters'

function LoadingMap() {
  const t = useTranslations('Map')
  return <div className="map"><div className="map__canvas"><p role="status">{t('loading')}</p></div></div>
}

const LeafletMap = dynamic(
  () => import('./leaflet-map').then((module) => module.LeafletMap),
  {
    ssr: false,
    loading: LoadingMap,
  },
)

interface Props {
  initialView?: MapView
  onViewChange?: (view: MapView) => void
  features: PublicMapFeature[]
  onSelect: (publicId: string) => void
  lang?: Locale
  onViewportChange?: (bounds: MapBounds) => void
  filters?: MapFilterValues
  onFiltersChange?: (values: MapFilterValues) => void
  groupRequestUrl?: string
  selectedPublicId?: string
}

export function PublicMapLoader({ initialView, onViewChange, features, onSelect, lang, onViewportChange, filters, onFiltersChange, groupRequestUrl, selectedPublicId }: Props) {
  return <LeafletMap initialView={initialView} onViewChange={onViewChange} features={features} onSelect={onSelect} lang={lang} onViewportChange={onViewportChange} filters={filters} onFiltersChange={onFiltersChange} groupRequestUrl={groupRequestUrl} selectedPublicId={selectedPublicId} />
}
