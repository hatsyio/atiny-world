import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'

import { letterDestination } from '@/components/navigation/letter-origin'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { LetterLocationMap } from '@/components/map/letter-location-map'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params, searchParams }: { params: Promise<{publicId: string; lang?: string}>; searchParams?: Promise<{ returnTo?: string | string[] }> }) {
  const { publicId } = await params
  const message = await getVisibleMessage(getDb(), publicId)
  const locale = await getLocale()
  const t = await getTranslations('Pages.publicLetter')
  const destination = letterDestination(locale, (await searchParams)?.returnTo)
  return <main className="message-page"><Link className="auth-back" href={destination.href}>← {destination.back}</Link><div className="message-content"><p className="auth-script">{t('script')}</p><h1>{t('title')}</h1><PublicMessageCard message={message} />{message ? <div className="message-map"><LetterLocationMap point={message.point} /></div> : null}</div></main>
}

export async function generateMetadata({params}: {params: Promise<{publicId: string}>}) {
  const {publicId} = await params
  const t = await getTranslations('Pages.publicLetter')
  return {title: t('title'), alternates: {canonical: `/messages/${encodeURIComponent(publicId)}`}}
}
