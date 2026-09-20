'use client'

import { useActionState, useEffect, useRef } from 'react'

import { useRouter } from 'next/navigation'

import { completeProfileAction } from '@/app/[lang]/profile/actions'

const copy = {
  en: {
    usernameLabel: 'Unique username',
    usernameHint: 'Only letters, numbers and underscores: the name others will search.',
    usernamePlaceholder: 'e.g. atiny-seoul',
    displayNameLabel: 'Public name',
    displayNameHint: 'Shown on your letters. It may include Korean, spaces and emojis.',
    displayNamePlaceholder: 'e.g. ATINY Seoul',
    submit: 'Continue',
    saving: 'Saving…',
    cancel: 'Back to the map',
    usernameUnavailable: 'This username is already taken. Choose another one.',
    usernameRequired: 'Choose a username.',
    usernameTooLong: 'The username is too long (max 30 characters).',
    displayNameRequired: 'Choose a public name.',
    displayNameTooLong: 'The public name is too long (max 50 characters).',
    genericError: 'We could not complete your profile. Try again.',
  },
  es: {
    usernameLabel: 'Usuario único',
    usernameHint: 'Solo letras, números y guiones bajos: el nombre por el que otros te buscarán.',
    usernamePlaceholder: 'p. ej. atiny-seoul',
    displayNameLabel: 'Nombre público',
    displayNameHint: 'Aparece en tus cartas. Admite coreano, espacios y emojis.',
    displayNamePlaceholder: 'p. ej. ATINY Seoul',
    submit: 'Continuar',
    saving: 'Guardando…',
    cancel: 'Volver al mapa',
    usernameUnavailable: 'Este usuario ya está en uso. Elige otro.',
    usernameRequired: 'Elige un usuario.',
    usernameTooLong: 'El usuario es demasiado largo (máximo 30 caracteres).',
    displayNameRequired: 'Elige un nombre público.',
    displayNameTooLong: 'El nombre público es demasiado largo (máximo 50 caracteres).',
    genericError: 'No pudimos completar tu perfil. Inténtalo de nuevo.',
  },
} as const

const fieldCopyKeys: Record<string, keyof typeof copy.en> = {
  'profile.usernameRequired': 'usernameRequired',
  'profile.usernameTooLong': 'usernameTooLong',
  'profile.displayNameRequired': 'displayNameRequired',
  'profile.displayNameTooLong': 'displayNameTooLong',
}

function fieldMessage(key: string | undefined, fallback: string): string {
  if (!key) return fallback
  return fieldCopyKeys[key] ?? fallback
}

export function ProfileCompletionForm({ lang }: { lang: 'en' | 'es' }) {
  const t = copy[lang]
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(completeProfileAction, null)
  const navigatedRef = useRef(false)

  const usernameError =
    state?.ok === false &&
    (state.error.messageKey === 'profile.usernameUnavailable'
      ? t.usernameUnavailable
      : state.error.fieldErrors?.username
        ? fieldMessage(state.error.fieldErrors.username, t.genericError)
        : null)
  const displayNameError =
    state?.ok === false
      ? state.error.fieldErrors?.displayName
        ? fieldMessage(state.error.fieldErrors.displayName, t.genericError)
        : null
      : null
  const genericError =
    state?.ok === false && usernameError === null && displayNameError === null
      ? t.genericError
      : null

  useEffect(() => {
    if (state?.ok === true && !navigatedRef.current) {
      navigatedRef.current = true
      router.push(`/${lang}/messages/new`)
      router.refresh()
    }
  }, [state, lang, router])

  return (
    <form action={formAction} className="profile-form">
      <div className="profile-field">
        <label htmlFor="profile-username">{t.usernameLabel}</label>
        <p className="profile-hint">{t.usernameHint}</p>
        <input
          id="profile-username"
          name="username"
          type="text"
          autoComplete="username"
          maxLength={60}
          placeholder={t.usernamePlaceholder}
          aria-invalid={usernameError !== null}
        />
        {usernameError !== null && <p className="profile-error" role="alert">{usernameError}</p>}
      </div>

      <div className="profile-field">
        <label htmlFor="profile-display-name">{t.displayNameLabel}</label>
        <p className="profile-hint">{t.displayNameHint}</p>
        <input
          id="profile-display-name"
          name="displayName"
          type="text"
          maxLength={80}
          placeholder={t.displayNamePlaceholder}
          aria-invalid={displayNameError !== null}
        />
        {displayNameError !== null && <p className="profile-error" role="alert">{displayNameError}</p>}
      </div>

      {genericError !== null && <p className="profile-error profile-error--general" role="alert">{genericError}</p>}

      {state?.ok === true && (
        <p className="profile-note" role="status">{lang === 'es' ? 'Perfil guardado. Te llevamos a publicar…' : 'Profile saved. Taking you to publish…'}</p>
      )}

      <div className="profile-actions">
        <button type="submit" className="profile-submit" disabled={isPending}>
          {isPending ? t.saving : t.submit}
        </button>
        <button type="button" className="profile-cancel" onClick={() => router.push(`/${lang}`)} disabled={isPending}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}