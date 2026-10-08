import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'

import { letterDestination } from '@/components/navigation/letter-origin'

import { PublicMessageCard } from '@/components/messages/public-message-card'
import { LetterDetail } from '@/components/messages/letter-detail'
import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity, readProfileByClerkUserId } from '@/server/auth/session'
import { getOwnMessage } from '@/server/messages/own-message-repository'
import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'

export default async function PublicMessagePage({ params, searchParams }: { params: Promise<{publicId: string}>; searchParams?: Promise<{ returnTo?: string | string[] }> }) {
  const { publicId } = await params
  const db = getDb()
  const publicMessage = await getVisibleMessage(db, publicId)
  const authorization = await authorizeSession(db)
  const suspended = !authorization.ok && authorization.error.code === 'ACCOUNT_SUSPENDED'
  const identity = authorization.ok || suspended ? await getSessionIdentity() : null
  const ownMessage = identity ? await getOwnMessage(db, { clerkUserId: identity.clerkUserId, publicId }) ?? undefined : undefined
  const ownerProfile = ownMessage && identity && suspended ? await readProfileByClerkUserId(db, identity.clerkUserId) : null
  const ownerAuthor = authorization.ok ? { publicId: authorization.data.publicId, displayName: authorization.data.displayName }
    : ownerProfile ? { publicId: ownerProfile.public_id, displayName: ownerProfile.display_name } : null
  // Private pending/rejected letters can be read only through the owner query.
  const message = ownMessage && ownerAuthor ? {
    ...ownMessage,
    countryCode: publicMessage?.countryCode ?? '',
    author: ownerAuthor,
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
        {message ? <LetterDetail message={message} ownMessage={ownMessage} canEdit={authorization.ok} /> : <PublicMessageCard message={null} />}
      </div>
    </main>
  )
}

export async function generateMetadata({params}: {params: Promise<{publicId: string}>}) {
  const {publicId} = await params
  const t = await getTranslations('Pages.publicLetter')
  return {title: t('title'), alternates: {canonical: `/messages/${encodeURIComponent(publicId)}`}}
}
