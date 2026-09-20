import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ProfileCompletionForm } from '@/components/account/profile-completion-form'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

const copy = {
  en: {
    back: 'Back to the map',
    script: 'Dear, ATEEZ…',
    title: 'Complete your profile',
    intro: 'Choose a unique username and the public name that will appear on your letters.',
    unavailable: 'Your account is not available right now.',
  },
  es: {
    back: 'Volver al mapa',
    script: 'Querido ATEEZ…',
    title: 'Completa tu perfil',
    intro: 'Elige un usuario único y el nombre público que mostrarán tus cartas.',
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
        <ProfileCompletionForm lang={locale} />
      </div>
    </main>
  )
}