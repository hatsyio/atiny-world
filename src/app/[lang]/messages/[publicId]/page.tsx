import Link from 'next/link'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { PublicMapController } from '@/components/map/public-map-controller'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params }: { params: Promise<{ lang: string; publicId: string }> }) {
  const { lang, publicId } = await params
  const message = await getVisibleMessage(getDb(), publicId)
  const locale = lang === 'es' ? 'es' : 'en'
  return <main><Link href={`/${locale}`}>ATINY World</Link><PublicMessageCard message={message} /><PublicMapController lang={locale} selectedPublicId={publicId} /></main>
}
