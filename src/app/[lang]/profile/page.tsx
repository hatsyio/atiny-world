import Link from 'next/link'
import { redirect } from 'next/navigation'

import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

const copy = {
  en: {
    back: 'Back to the map',
    script: 'Dear, ATEEZ…',
    title: 'Finishing your account',
    intro: 'We could not create your profile yet. Try again in a moment.',
    unavailable: 'Your account is not available right now.',
  },
  es: {
    back: 'Volver al mapa',
    script: 'Querido ATEEZ…',
    title: 'Terminando tu cuenta',
    intro: 'Todavía no hemos podido crear tu perfil. Vuelve a intentarlo en un momento.',
    unavailable: 'Tu cuenta no está disponible en este momento.',
  },
} as const

export default async function ProfilePage({
  params,
}: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const gate = await resolveAccountGate(getDb())

  if (gate.kind === 'anonymous') redirect(`/${locale}/sign-in`)
  if (gate.kind === 'allowed') redirect(`/${locale}/messages/new`)

  const back = <Link className="auth-back" href={`/${locale}`}>← {t.back}</Link>

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
        <Link className="profile-submit" href={`/${locale}/auth/continue`}>{locale === 'es' ? 'Reintentar' : 'Try again'}</Link>
      </div>
    </main>
  )
}
