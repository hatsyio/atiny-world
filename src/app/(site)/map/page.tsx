import { getTranslations } from 'next-intl/server'
import { MapExplorer } from '@/components/map/map-explorer'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const t = await getTranslations('Map.explorer')
  return <main className="map-page" id="map" tabIndex={-1} aria-labelledby="map-title">
    <h1 id="map-title">{t('title')}</h1>
    <MapExplorer />
  </main>
}

export async function generateMetadata() {
  const t = await getTranslations('Map.explorer')
  return { title: t('title'), description: t('description'), alternates: { canonical: '/map' } }
}
