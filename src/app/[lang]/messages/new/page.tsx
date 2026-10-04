import Link from 'next/link'
import { redirect } from 'next/navigation'

import { returnDestination } from '@/components/navigation/return-destination'
import { CreateMessageFlow } from '@/components/messages/create-message-flow'
import { resolveAccountGate, writeLetterRedirect } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

const copy = {
  en: {
    script: 'Dear, ATEEZ…',
    title: 'Write a letter',
    intro: 'Write your letter and choose where it will appear on the map.',
    unavailable: 'Your account is not available, so you cannot publish a letter right now.',
  },
  es: {
    script: 'Querido ATEEZ…',
    title: 'Escribir una carta',
    intro: 'Escribe tu carta y elige dónde aparecerá en el mapa.',
    unavailable: 'Tu cuenta no está disponible, así que no puedes publicar una carta ahora mismo.',
  },
} as const

export default async function NewMessagePage({
  params,
  searchParams,
}: { params: Promise<{ lang: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const { returnTo } = await searchParams
  const origin = returnDestination(locale, returnTo)
  const gate = await resolveAccountGate(getDb())

  const destination = writeLetterRedirect(gate, locale)
  if (destination !== null) redirect(destination)

  const back = <Link className="auth-back" href={origin.href}>← {origin.back}</Link>

  if (gate.kind === 'suspended' || gate.kind === 'deletion-pending') {
    return (
      <main className="auth-page">
        {back}
        <div className="auth-panel">
          <p className="auth-script">{t.script}</p>
          <h1>{t.title}</h1>
          <p className="profile-intro">{t.unavailable}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      {back}
      <div className="auth-panel">
        <p className="auth-script">{t.script}</p>
        <h1>{t.title}</h1>
        <p className="profile-intro">{t.intro}</p>
        <CreateMessageFlow lang={locale} returnTo={origin.href} />
      </div>
    </main>
  )
}
