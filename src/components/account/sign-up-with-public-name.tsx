'use client'

import { SignUp } from '@clerk/nextjs'
import { useSignUp } from '@clerk/nextjs/legacy'
import { useState } from 'react'

export function SignUpWithPublicName({ lang }: { lang: 'en' | 'es' }) {
  const { isLoaded, signUp } = useSignUp()
  const [editedName, setEditedName] = useState<string | null>(null)
  const savedName = signUp?.unsafeMetadata?.publicName
  const registrationStarted = typeof savedName === 'string' && savedName.trim().length > 0
  const publicName = registrationStarted ? savedName : (editedName ?? '')
  const name = publicName.trim()
  const valid = name.length > 0 && Array.from(name).length <= 50
  const label = lang === 'es' ? 'Nombre público' : 'Public name'

  return (
    <div>
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
          disabled={registrationStarted}
          aria-invalid={publicName.length > 0 && !valid}
          maxLength={100}
          required
        />
        {publicName.length > 0 && !valid && <p className="profile-error" role="alert">{lang === 'es' ? 'Usa entre 1 y 50 caracteres.' : 'Use 1 to 50 characters.'}</p>}
      </div>
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
