import { getTranslations } from 'next-intl/server'
import { PublicMapController } from '@/components/map/public-map-controller'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export const dynamic = 'force-dynamic'

export default async function MapPage({ searchParams }: { searchParams: Promise<{ letter?: string | string[] }> }) {
  const { letter } = await searchParams
  const message = typeof letter === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(letter) ? await getVisibleMessage(getDb(), letter) : null
  const selectedMessage = message ? {
    publicId: message.publicId, point: message.point, precision: message.precision,
    locality: message.locality, country: message.country, countryCode: message.countryCode,
    publishedAt: message.publishedAt, author: message.author,
  } : undefined
  const t = await getTranslations('Pages.home')
  return <main className="letters-archive"><section id="map" tabIndex={-1} aria-labelledby="map-title">
    <h1 id="map-title">{t('mapTitle')}</h1><p>{t('mapHint')}</p>
    <div className="live-map-frame"><PublicMapController selectedMessage={selectedMessage} originPath="/map" /></div>
  </section></main>
}
