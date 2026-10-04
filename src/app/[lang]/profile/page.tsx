import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { recoverUsername } from '@/server/actions/recover-username'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

const copy = {
  en: {
    back: 'Back to the map',
    script: 'Dear, ATEEZ…',
    title: 'Finishing your account',
    intro: 'We could not create your profile yet. Try again in a moment.',
    unavailable: 'Your account is not available right now.',
    usernameTitle: 'Choose a username',
    usernameIntro: 'Your account needs a username before you can continue. Choose one here to finish setting it up.',
    usernameLabel: 'Username',
    usernameSubmit: 'Save username',
    usernameInvalid: 'Use between 4 and 64 characters.',
    usernameUnavailable: 'We could not save that username. Try another, or contact support if the problem continues.',
  },
  es: {
    back: 'Volver al mapa',
    script: 'Querido ATEEZ…',
    title: 'Terminando tu cuenta',
    intro: 'Todavía no hemos podido crear tu perfil. Vuelve a intentarlo en un momento.',
    unavailable: 'Tu cuenta no está disponible en este momento.',
    usernameTitle: 'Elige un nombre de usuario',
    usernameIntro: 'Tu cuenta necesita un nombre de usuario para continuar. Elige uno aquí para terminar la configuración.',
    usernameLabel: 'Nombre de usuario',
    usernameSubmit: 'Guardar nombre de usuario',
    usernameInvalid: 'Usa entre 4 y 64 caracteres.',
    usernameUnavailable: 'No hemos podido guardar ese nombre. Prueba otro o contacta con soporte si el problema continúa.',
  },
} as const

export default async function ProfilePage({
  params,
  searchParams,
}: { params: Promise<{ lang: string }>; searchParams: Promise<{ error?: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const gate = await resolveAccountGate(getDb())

  if (gate.kind === 'anonymous') redirect(`/${locale}/sign-in`)
  if (gate.kind === 'allowed') redirect(`/${locale}`)

  const back = <Link className="auth-back" href={`/${locale}#map`}>← {t.back}</Link>

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

  const user = await currentUser()
  const legacyName = user?.unsafeMetadata?.publicName
  if (user && !user.username && !(typeof legacyName === 'string' && legacyName.trim())) {
    const { error } = await searchParams
    return (
      <main className="auth-page">
        {back}
        <div className="auth-panel">
          <p className="auth-script">{t.script}</p>
          <h1>{t.usernameTitle}</h1>
          <p className="profile-intro">{t.usernameIntro}</p>
          <form className="profile-form" action={recoverUsername.bind(null, locale)}>
            <div className="profile-field">
              <label htmlFor="recovery-username">{t.usernameLabel}</label>
              <input id="recovery-username" name="username" type="text" autoComplete="username" minLength={4} maxLength={64} required />
              {error && <p className="profile-error" role="alert">{error === 'invalid' ? t.usernameInvalid : t.usernameUnavailable}</p>}
            </div>
            <button className="profile-submit" type="submit">{t.usernameSubmit}</button>
          </form>
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
