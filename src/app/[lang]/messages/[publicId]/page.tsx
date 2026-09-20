import Link from 'next/link'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { PublicMapController } from '@/components/map/public-map-controller'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params }: { params: Promise<{ lang: string; publicId: string }> }) {
  const { lang, publicId } = await params
  const message = await getVisibleMessage(getDb(), publicId)
  const locale = lang === 'es' ? 'es' : 'en'
  return <main className="message-page"><Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link><div className="message-content"><p className="auth-script">Dear, ATEEZ…</p><h1>{locale === 'es' ? 'Una carta de ATINY' : 'A letter from ATINY'}</h1><PublicMessageCard message={message} /><div className="message-map"><PublicMapController lang={locale} selectedPublicId={publicId} /></div></div></main>
}
