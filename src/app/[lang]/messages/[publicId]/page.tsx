import Link from 'next/link'

import { letterDestination } from '@/components/navigation/letter-origin'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { PublicMapController } from '@/components/map/public-map-controller'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params, searchParams }: { params: Promise<{ lang: string; publicId: string }>; searchParams?: Promise<{ returnTo?: string | string[] }> }) {
  const { lang, publicId } = await params
  const message = await getVisibleMessage(getDb(), publicId)
  const locale = lang === 'es' ? 'es' : 'en'
  const destination = letterDestination(locale, (await searchParams)?.returnTo)
  return <main className="message-page"><Link className="auth-back" href={destination.href}>← {destination.back}</Link><div className="message-content"><p className="auth-script">Dear, ATEEZ…</p><h1>{locale === 'es' ? 'Una carta de ATINY' : 'A letter from ATINY'}</h1><PublicMessageCard message={message} /><div className="message-map"><PublicMapController lang={locale} selectedPublicId={publicId} /></div></div></main>
}
