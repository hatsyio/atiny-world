'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateMessageAction,
  type UpdateMessageActionResult,
} from '@/app/[lang]/my-messages/actions'
import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'
import { MAX_GRAPHEMES, countGraphemes } from '@/domain/messages/content'
import type { OwnMessage } from '@/domain/messages/own-message'
import type { UpdateMessageActionInput } from '@/server/actions/update-message'

export type EditMessageSubmit = (
  input: UpdateMessageActionInput,
) => Promise<UpdateMessageActionResult>

export interface EditMessageFormProps {
  lang?: 'en' | 'es'
  message: Pick<OwnMessage, 'publicId' | 'version' | 'content' | 'country' | 'precision' | 'locality'>
  submitUpdate?: EditMessageSubmit
}

const copy = {
  en: {
    content: 'Your letter',
    contentPlaceholder: 'Dear ATEEZ…',
    characters: 'characters',
    currentLocation: 'Current location',
    approximate: 'Approximate point',
    precise: 'Exact public point',
    changeLocation: 'Choose a new place (optional)',
    locationHint: 'Leave this empty to keep the current point.',
    save: 'Save changes',
    saving: 'Saving…',
    cancel: 'Cancel',
    conflict: 'This letter changed since you opened it. Return to your messages and try again.',
    unavailable: 'This letter is no longer available to edit.',
    suspended: 'Your account cannot edit letters right now.',
    invalid: 'Check the letter and selected place, then try again.',
    error: 'We could not save your changes. Try again soon.',
  },
  es: {
    content: 'Tu carta',
    contentPlaceholder: 'Querido ATEEZ…',
    characters: 'caracteres',
    currentLocation: 'Ubicación actual',
    approximate: 'Punto aproximado',
    precise: 'Punto público exacto',
    changeLocation: 'Elige otro lugar (opcional)',
    locationHint: 'Déjalo vacío para conservar el punto actual.',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    conflict: 'La carta cambió desde que la abriste. Vuelve a tus mensajes e inténtalo de nuevo.',
    unavailable: 'Esta carta ya no está disponible para editar.',
    suspended: 'Tu cuenta no puede editar cartas en este momento.',
    invalid: 'Revisa la carta y el lugar elegido e inténtalo de nuevo.',
    error: 'No se pudieron guardar los cambios. Inténtalo de nuevo pronto.',
  },
} as const

export function EditMessageForm({
  lang = 'en',
  message,
  submitUpdate = updateMessageAction,
}: EditMessageFormProps) {
  const t = copy[lang]
  const router = useRouter()
  const [content, setContent] = useState(message.content)
  const [location, setLocation] = useState<LocationPickerSelection | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const characterCount = countGraphemes(content)
  const invalidContent = characterCount === 0 || characterCount > MAX_GRAPHEMES

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || invalidContent) return

    setSaving(true)
    setError(null)
    try {
      const result = await submitUpdate({
        publicId: message.publicId,
        expectedVersion: message.version,
        content,
        ...(location !== null ? { location } : {}),
      })
      if (result.ok) {
        router.push(`/${lang}/my-messages`)
        return
      }

      switch (result.error.code) {
        case 'MESSAGE_VERSION_CONFLICT':
          setError(t.conflict)
          break
        case 'NOT_FOUND':
          setError(t.unavailable)
          break
        case 'ACCOUNT_SUSPENDED':
          setError(t.suspended)
          break
        case 'VALIDATION_ERROR':
        case 'LOCATION_SELECTION_REQUIRED':
        case 'LOCATION_SELECTION_EXPIRED':
        case 'LOCATION_SELECTION_INVALID':
          setError(t.invalid)
          break
        default:
          setError(t.error)
          break
      }
    } catch {
      setError(t.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
      {error ? <p className="profile-error profile-error--general" role="alert">{error}</p> : null}
      <div className="profile-field">
        <label htmlFor="edit-message-content">{t.content}</label>
        <textarea
          id="edit-message-content"
          name="content"
          rows={8}
          value={content}
          placeholder={t.contentPlaceholder}
          aria-describedby="edit-message-counter"
          onChange={(event) => setContent(event.target.value)}
        />
        <p id="edit-message-counter" className="message-counter" aria-live="polite">
          {characterCount}/{MAX_GRAPHEMES} {t.characters}
        </p>
      </div>

      <p className="profile-note">
        {t.currentLocation}: {message.locality ? `${message.locality}, ` : ''}{message.country} — {message.precision === 'precise' ? t.precise : t.approximate}
      </p>
      <fieldset>
        <legend>{t.changeLocation}</legend>
        <p className="profile-hint">{t.locationHint}</p>
        <LocationPicker lang={lang} onChange={setLocation} />
      </fieldset>

      <div className="profile-actions">
        <button type="submit" className="profile-submit" disabled={saving || invalidContent}>
          {saving ? t.saving : t.save}
        </button>
        <button
          type="button"
          className="profile-cancel"
          disabled={saving}
          onClick={() => router.push(`/${lang}/my-messages`)}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
