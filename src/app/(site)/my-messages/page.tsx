import {getLocale, getTranslations} from 'next-intl/server'
import { authRoute } from '@/server/auth/auth-destination'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MyMessageList } from '@/components/messages/my-message-list'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { pageOwnMessages } from '@/server/messages/own-message-repository'



export default async function MyMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const locale = await getLocale()
  const { cursor } = await searchParams
  const destination = `/my-messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const t = await getTranslations('Pages.ownLetters')
  const gate = await resolveAccountGate(getDb())

  if (gate.kind === 'anonymous') redirect(authRoute(locale, 'sign-in', destination))
  if (gate.kind === 'incomplete') redirect(authRoute(locale, 'profile', destination))

  const back = <Link className="auth-back" href={'/#map'}>← {t('back')}</Link>
  if (gate.kind === 'deletion-pending') {
    return <main className="auth-page">{back}<div className="auth-panel"><p className="auth-script">{t('script')}</p><h1>{t('title')}</h1><p className="profile-intro">{t('unavailable')}</p></div></main>
  }

  const identity = await getSessionIdentity()
  if (!identity) redirect(authRoute(locale, 'sign-in', destination))
  const page = await pageOwnMessages(getDb(), { clerkUserId: identity.clerkUserId, cursor })

  return (
    <main className="auth-page">
      {back}
      <div className="auth-panel my-messages-panel">
        <p className="auth-script">{t('script')}</p>
        <h1>{t('title')}</h1>
        <p className="profile-intro">{t('intro')}</p>
        <MyMessageList cursor={cursor} messages={page.items} accountSuspended={gate.kind === 'suspended'} />
        {page.nextCursor ? <Link className="profile-cancel" href={`/my-messages?cursor=${encodeURIComponent(page.nextCursor)}`}>{t('next')}</Link> : null}
      </div>
    </main>
  )
}
