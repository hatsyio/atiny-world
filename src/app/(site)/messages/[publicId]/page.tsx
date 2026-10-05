import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'

import { letterDestination } from '@/components/navigation/letter-origin'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { LetterDetail } from '@/components/messages/letter-detail'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { pageOwnMessages } from '@/server/messages/own-message-repository'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params, searchParams }: { params: Promise<{publicId: string; lang?: string}>; searchParams?: Promise<{ returnTo?: string | string[] }> }) {
  const { publicId } = await params
  const db = getDb()
  const publicMessage = await getVisibleMessage(db, publicId)
  const authorization = await authorizeSession(db)
  const identity = authorization.ok ? await getSessionIdentity() : null
  const ownMessage = identity ? (await pageOwnMessages(db, { clerkUserId: identity.clerkUserId, limit: 100 })).items.find(item => item.publicId === publicId) : undefined
  // Private pending/rejected letters can be read only through the owner query.
  const message = ownMessage && authorization.ok ? {
    ...ownMessage,
    countryCode: publicMessage?.countryCode ?? '',
    author: { publicId: authorization.data.publicId, displayName: authorization.data.displayName },
  } : publicMessage
  const locale = await getLocale()
  const t = await getTranslations('Pages.publicLetter')
  const destination = letterDestination(locale, (await searchParams)?.returnTo)
  return (
    <main className="message-page">
      <Link className="auth-back" href={destination.href}>← {destination.back}</Link>
      <div className="message-content letter-panel">
        <p className="auth-script">{t('script')}</p>
        <h1>{t('title')}</h1>
        {message ? <LetterDetail message={message} ownMessage={ownMessage} /> : <PublicMessageCard message={null} />}
      </div>
    </main>
  )
}

export async function generateMetadata({params}: {params: Promise<{publicId: string}>}) {
  const {publicId} = await params
  const t = await getTranslations('Pages.publicLetter')
  return {title: t('title'), alternates: {canonical: `/messages/${encodeURIComponent(publicId)}`}}
}
