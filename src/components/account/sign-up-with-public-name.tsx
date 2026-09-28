'use client'

import { SignUp } from '@clerk/nextjs'
import { useSignUp } from '@clerk/nextjs/legacy'
import { useState } from 'react'

export function SignUpWithPublicName({ lang }: { lang: 'en' | 'es' }) {
  const { isLoaded, signUp } = useSignUp()
  const [editedName, setEditedName] = useState<string | null>(null)
  const [continueToClerk, setContinueToClerk] = useState(false)
  const savedName = signUp?.unsafeMetadata?.publicName
  const registrationStarted = typeof savedName === 'string' && savedName.trim().length > 0
  const publicName = registrationStarted ? savedName : (editedName ?? '')
  const name = publicName.trim()
  const valid = name.length > 0 && Array.from(name).length <= 50
  const label = lang === 'es' ? 'Nombre público' : 'Public name'

  if (registrationStarted || continueToClerk) {
    return (
      <div className="clerk-auth-step">
        {!registrationStarted && (
          <button className="signup-back" type="button" onClick={() => setContinueToClerk(false)}>
            ← {lang === 'es' ? 'Cambiar nombre público' : 'Change public name'}
          </button>
        )}
        {isLoaded && valid && (
          <SignUp
            unsafeMetadata={{ publicName: name }}
            signInUrl={`/${lang}/sign-in`}
            fallbackRedirectUrl={`/${lang}/auth/continue`}
            signInFallbackRedirectUrl={`/${lang}/auth/continue`}
          />
        )}
      </div>
    )
  }

  return (
    <section className="auth-panel signup-name-panel" aria-labelledby="signup-title">
      <p className="auth-script">Dear, ATEEZ…</p>
      <h1 id="signup-title">{lang === 'es' ? 'Únete a atiny world' : 'Join atiny world'}</h1>
      <form className="signup-name-form" onSubmit={(event) => {
        event.preventDefault()
        if (valid) setContinueToClerk(true)
      }}>
        <div className="profile-field">
          <label htmlFor="signup-public-name">{label}</label>
          <p className="profile-hint">{lang === 'es' ? 'Aparecerá en tus cartas. Puedes usar espacios y emojis.' : 'Shown on your letters. Spaces and emojis are welcome.'}</p>
          <input
            id="signup-public-name"
            name="publicName"
            type="text"
            autoComplete="nickname"
            value={publicName}
            onChange={(event) => setEditedName(event.target.value)}
            aria-invalid={publicName.length > 0 && !valid}
            maxLength={100}
            required
          />
          {publicName.length > 0 && !valid && <p className="profile-error" role="alert">{lang === 'es' ? 'Usa entre 1 y 50 caracteres.' : 'Use 1 to 50 characters.'}</p>}
        </div>
        <button className="signup-continue" type="submit" disabled={!valid}>
          {lang === 'es' ? 'Continuar' : 'Continue'}
        </button>
      </form>
    </section>
  )
}
