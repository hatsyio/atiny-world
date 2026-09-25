import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MyMessageList } from '@/components/messages/my-message-list'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { pageOwnMessages } from '@/server/messages/own-message-repository'

const copy = {
  en: {
    back: 'Back to the map',
    script: 'Dear, ATEEZ…',
    title: 'Your letters',
    intro: 'See every letter you have sent, including its moderation status.',
    next: 'Load older letters',
    unavailable: 'Your account is not available right now.',
  },
  es: {
    back: 'Volver al mapa',
    script: 'Querido ATEEZ…',
    title: 'Mis mensajes',
    intro: 'Consulta todas las cartas que has enviado, incluido su estado de moderación.',
    next: 'Ver cartas anteriores',
    unavailable: 'Tu cuenta no está disponible en este momento.',
  },
} as const

export default async function MyMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const gate = await resolveAccountGate(getDb())

  if (gate.kind === 'anonymous') redirect(`/${locale}/sign-in`)
  if (gate.kind === 'incomplete') redirect(`/${locale}/profile`)

  const back = <Link className="auth-back" href={`/${locale}`}>← {t.back}</Link>
  if (gate.kind === 'deletion-pending') {
    return <main className="auth-page">{back}<div className="auth-panel"><p className="auth-script">{t.script}</p><h1>{t.title}</h1><p className="profile-intro">{t.unavailable}</p></div></main>
  }

  const identity = await getSessionIdentity()
  if (!identity) redirect(`/${locale}/sign-in`)
  const { cursor } = await searchParams
  const page = await pageOwnMessages(getDb(), { clerkUserId: identity.clerkUserId, cursor })

  return (
    <main className="auth-page">
      {back}
      <div className="auth-panel my-messages-panel">
        <p className="auth-script">{t.script}</p>
        <h1>{t.title}</h1>
        <p className="profile-intro">{t.intro}</p>
        <MyMessageList lang={locale} messages={page.items} accountSuspended={gate.kind === 'suspended'} />
        {page.nextCursor ? <Link className="profile-cancel" href={`/${locale}/my-messages?cursor=${encodeURIComponent(page.nextCursor)}`}>{t.next}</Link> : null}
      </div>
    </main>
  )
}
