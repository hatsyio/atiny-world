import Link from 'next/link'
import { redirect } from 'next/navigation'

import { resolveAccountGate, writeLetterRedirect } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

const copy = {
  en: {
    back: 'Back to the map',
    script: 'Dear, ATEEZ…',
    title: 'Write your letter',
    unavailable: 'Your account is not available, so you cannot publish a letter right now.',
    comingSoon: 'The letter composer will be ready in the next delivery. Meanwhile, explore the map.',
  },
  es: {
    back: 'Volver al mapa',
    script: 'Querido ATEEZ…',
    title: 'Escribe tu carta',
    unavailable: 'Tu cuenta no está disponible, así que no puedes publicar una carta ahora mismo.',
    comingSoon: 'El compositor de cartas estará listo en la próxima entrega. Mientras tanto, explora el mapa.',
  },
} as const

export default async function NewMessagePage({
  params,
}: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const gate = await resolveAccountGate(getDb())

  const destination = writeLetterRedirect(gate, locale)
  if (destination !== null) redirect(destination)

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
        <p className="profile-intro">{t.comingSoon}</p>
      </div>
    </main>
  )
}