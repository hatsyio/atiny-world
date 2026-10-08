import {getLocale, getTranslations} from 'next-intl/server'
import { authRoute } from '@/server/auth/auth-destination'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EditMessageForm } from '@/components/messages/edit-message-form'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { getOwnMessage } from '@/server/messages/own-message-repository'



export default async function EditOwnMessagePage({
  params,
}: {
  params: Promise<{publicId: string}>
}) {
  const { publicId } = await params
  const locale = await getLocale()
  const destination = `/my-messages/${publicId}/edit`
  const t = await getTranslations('Pages.editLetter')
  const db = getDb()
  const gate = await resolveAccountGate(db)

  if (gate.kind === 'anonymous') redirect(authRoute(locale, 'sign-in', destination))
  if (gate.kind === 'incomplete') redirect(authRoute(locale, 'profile', destination))
  if (gate.kind !== 'allowed') redirect('/my-messages')

  const identity = await getSessionIdentity()
  if (!identity) redirect(authRoute(locale, 'sign-in', destination))

  // This owner-only query prevents an administrator or another account from
  // loading someone else's text into the edit form.
  const message = await getOwnMessage(db, { clerkUserId: identity.clerkUserId, publicId })
  if (!message) notFound()

  return (
    <main className="auth-page">
      <Link className="auth-back" href={'/my-messages'}>← {t('back')}</Link>
      <div className="auth-panel letter-panel">
        <p className="auth-script">{t('script')}</p>
        <h1>{t('title')}</h1>
        <EditMessageForm message={message} />
      </div>
    </main>
  )
}
