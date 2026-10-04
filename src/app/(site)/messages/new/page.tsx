import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { returnDestination } from '@/components/navigation/return-destination'
import { CreateMessageFlow } from '@/components/messages/create-message-flow'
import { resolveAccountGate, writeLetterRedirect } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'



export default async function NewMessagePage({
  searchParams,
}: { params?: Promise<{lang?: string}>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const locale = await getLocale()
  const t = await getTranslations('Pages.newLetter')
  const { returnTo } = await searchParams
  const origin = returnDestination(locale, returnTo)
  const gate = await resolveAccountGate(getDb())

  const requestedAction = `/messages/new${returnTo ? `?returnTo=${encodeURIComponent(origin.href)}` : ''}`
  const destination = writeLetterRedirect(gate, locale, requestedAction)
  if (destination !== null) redirect(destination)

  const back = <Link className="auth-back" href={origin.href}>← {origin.back}</Link>

  if (gate.kind === 'suspended' || gate.kind === 'deletion-pending') {
    return (
      <main className="auth-page">
        {back}
        <div className="auth-panel">
          <p className="auth-script">{t('script')}</p>
          <h1>{t('title')}</h1>
          <p className="profile-intro">{t('unavailable')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      {back}
      <div className="auth-panel">
        <p className="auth-script">{t('script')}</p>
        <h1>{t('title')}</h1>
        <p className="profile-intro">{t('intro')}</p>
        <CreateMessageFlow lang={locale} returnTo={origin.href} />
      </div>
    </main>
  )
}
