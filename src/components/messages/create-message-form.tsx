'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createMessageAction, type CreateMessageActionResult } from '@/app/[lang]/actions/create-message'
import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'
import { RECIPIENTS, type Recipient } from '@/domain/contracts'
import { MAX_GRAPHEMES, countGraphemes } from '@/domain/messages/content'
import type { CreateMessageActionInput } from '@/server/actions/create-message'

const copy = {
  en: {
    contentLabel: 'Your letter',
    contentPlaceholder: 'Dear ATEEZ…',
    counterLabel: 'characters',
    contentRequired: 'Write your letter before publishing.',
    contentTooLong: 'This letter is too long. Shorten it before publishing.',
    recipientLabel: 'Recipient',
    recipientNone: '—',
    recipientInvalid: 'This recipient is not allowed. Choose one from the list.',
    locationRequired: 'Choose a place to publish your letter.',
    locationMissing: 'Search for and confirm a place before publishing.',
    locationExpired: 'That place selection expired. Search again and choose a place.',
    locationInvalid: 'That place selection is not valid. Search again and choose a place.',
    publish: 'Publish letter',
    publishing: 'Publishing…',
    cancel: 'Cancel',
    cooldown: 'You can publish another letter in {seconds} seconds.',
    limitTitle: 'You reached the limit of letters you can publish',
    limitText: 'Manage your published letters before publishing a new one.',
    myMessages: 'My messages',
    publishedTitle: 'Letter sent!',
    publishedText: 'It is pending moderation and will appear on the map once approved.',
    accountUnavailable: 'Your account is not available right now, so the letter could not be published.',
    genericError: 'We could not publish your letter. Try again soon.',
  },
  es: {
    contentLabel: 'Tu carta',
    contentPlaceholder: 'Querido ATEEZ…',
    counterLabel: 'caracteres',
    contentRequired: 'Escribe tu carta antes de publicar.',
    contentTooLong: 'Esta carta es demasiado larga. Acórtala antes de publicar.',
    recipientLabel: 'Destinatario',
    recipientNone: '—',
    recipientInvalid: 'Este destinatario no está permitido. Elige uno de la lista.',
    locationRequired: 'Elige un lugar para publicar tu carta.',
    locationMissing: 'Busca y confirma un lugar antes de publicar.',
    locationExpired: 'Esa selección de lugar ha caducado. Busca de nuevo y elige un lugar.',
    locationInvalid: 'Esa selección de lugar no es válida. Busca de nuevo y elige un lugar.',
    publish: 'Publicar carta',
    publishing: 'Publicando…',
    cancel: 'Cancelar',
    cooldown: 'Podrás publicar otra carta en {seconds} segundos.',
    limitTitle: 'Llegaste al límite de cartas que puedes publicar',
    limitText: 'Gestiona tus cartas publicadas antes de publicar una nueva.',
    myMessages: 'Mis mensajes',
    publishedTitle: '¡Carta enviada!',
    publishedText: 'Está pendiente de moderación y aparecerá en el mapa en cuanto sea aprobada.',
    accountUnavailable: 'Tu cuenta no está disponible ahora mismo, así que la carta no se pudo publicar.',
    genericError: 'No pudimos publicar tu carta. Inténtalo pronto de nuevo.',
  },
} as const

export type CreateMessageSubmit = (
  input: CreateMessageActionInput,
) => Promise<CreateMessageActionResult>

export type FormFieldErrors = {
  content?: 'required' | 'tooLong'
  recipient?: 'invalid'
  location?: 'required' | 'expired' | 'invalid'
}

export interface CreateMessageFormProps {
  lang?: 'en' | 'es'
  onPublished?: (publicId: string) => void
  submitMessage?: CreateMessageSubmit
}

export function CreateMessageForm({
  lang = 'en',
  onPublished,
  submitMessage = createMessageAction,
}: CreateMessageFormProps) {
  const t = copy[lang]
  const router = useRouter()

  const [content, setContent] = useState('')
  const [recipient, setRecipient] = useState<Recipient>(null)
  const [location, setLocation] = useState<LocationPickerSelection | null>(null)
  const [pickerResetKey, setPickerResetKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [publishedPublicId, setPublishedPublicId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({})
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [limitBlocked, setLimitBlocked] = useState(false)
  const [accountError, setAccountError] = useState(false)
  const [genericError, setGenericError] = useState(false)

  const graphemeCount = countGraphemes(content)
  const contentTooLong = graphemeCount > MAX_GRAPHEMES
  const cooldownActive = cooldownRemaining > 0

  const publishDisabled =
    sending ||
    cooldownActive ||
    limitBlocked ||
    fieldErrors.location !== undefined ||
    location === null ||
    graphemeCount === 0 ||
    contentTooLong

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = setTimeout(() => {
      setCooldownRemaining((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => clearTimeout(timer)
  }, [cooldownRemaining])

  function handleRecipientChange(value: string) {
    const next = (RECIPIENTS as readonly string[]).includes(value) ? (value as Recipient) : null
    setRecipient(next)
    setFieldErrors((errors) => (errors.recipient === undefined ? errors : { ...errors, recipient: undefined }))
  }

  function handleLocationChange(next: LocationPickerSelection | null) {
    setLocation(next)
    setFieldErrors((errors) => (errors.location === undefined ? errors : { ...errors, location: undefined }))
  }

  function applySubmitError(
    error: Extract<CreateMessageActionResult, { ok: false }>['error'],
  ) {
    switch (error.code) {
      case 'MESSAGE_LIMIT_REACHED':
        setLimitBlocked(true)
        break
      case 'MESSAGE_COOLDOWN_ACTIVE':
        setCooldownRemaining(Math.max(1, error.retryAfterSeconds ?? 1))
        break
      case 'VALIDATION_ERROR': {
        const fields = error.fieldErrors ?? {}
        setFieldErrors({
          content:
            fields.content === 'message.content.required'
              ? 'required'
              : fields.content === 'message.content.limitReached'
                ? 'tooLong'
                : undefined,
          recipient: fields.recipient === 'message.recipient.invalid' ? 'invalid' : undefined,
          location: fields.location === 'location.invalidPublicPoint' ? 'invalid' : undefined,
        })
        break
      }
      case 'LOCATION_SELECTION_REQUIRED':
        setFieldErrors((errors) => ({ ...errors, location: 'required' }))
        break
      case 'LOCATION_SELECTION_EXPIRED':
        setFieldErrors((errors) => ({ ...errors, location: 'expired' }))
        break
      case 'LOCATION_SELECTION_INVALID':
        setFieldErrors((errors) => ({ ...errors, location: 'invalid' }))
        break
      case 'PROFILE_INCOMPLETE':
      case 'ACCOUNT_SUSPENDED':
      case 'NOT_FOUND':
        setAccountError(true)
        break
      default:
        setGenericError(true)
        break
    }
  }

  async function handlePublish() {
    if (sending || publishDisabled || location === null) return
    setSending(true)
    setFieldErrors({})
    setAccountError(false)
    setGenericError(false)
    try {
      const result = await submitMessage({ content, recipient, location })
      if (result.ok) {
        onPublished?.(result.data.publicId)
        setPublishedPublicId(result.data.publicId)
        setContent('')
        setRecipient(null)
        setLocation(null)
        setPickerResetKey((key) => key + 1)
      } else {
        applySubmitError(result.error)
      }
    } catch {
      setGenericError(true)
    } finally {
      setSending(false)
    }
  }

  const contentAlert =
    fieldErrors.content === 'required' ? t.contentRequired
      : contentTooLong || fieldErrors.content === 'tooLong' ? t.contentTooLong
        : null
  const locationAlert =
    fieldErrors.location === 'required' ? t.locationRequired
      : fieldErrors.location === 'expired' ? t.locationExpired
        : fieldErrors.location === 'invalid' ? t.locationInvalid
          : null
  const descriptionId = contentAlert !== null ? 'message-counter message-content-error' : 'message-counter'

  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault()
        void handlePublish()
      }}
    >
      {publishedPublicId !== null && (
        <p className="profile-note" role="status">
          <strong>{t.publishedTitle}</strong> {t.publishedText}
        </p>
      )}

      <div className="profile-field">
        <label htmlFor="message-content">{t.contentLabel}</label>
        <textarea
          id="message-content"
          name="content"
          rows={8}
          value={content}
          placeholder={t.contentPlaceholder}
          aria-invalid={contentAlert !== null}
          aria-describedby={descriptionId}
          onChange={(event) => {
            setContent(event.target.value)
            setFieldErrors((errors) => (errors.content === undefined ? errors : { ...errors, content: undefined }))
          }}
        />
        <p id="message-counter" className="message-counter" aria-live="polite">
          {graphemeCount}/{MAX_GRAPHEMES} {t.counterLabel}
        </p>
        {contentAlert !== null && (
          <p id="message-content-error" className="profile-error" role="alert">
            {contentAlert}
          </p>
        )}
      </div>

      <div className="profile-field">
        <label htmlFor="message-recipient">{t.recipientLabel}</label>
        <select
          id="message-recipient"
          name="recipient"
          value={recipient ?? ''}
          aria-invalid={fieldErrors.recipient !== undefined}
          onChange={(event) => handleRecipientChange(event.target.value)}
        >
          <option value="">{t.recipientNone}</option>
          {RECIPIENTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {fieldErrors.recipient === 'invalid' && (
          <p className="profile-error" role="alert">
            {t.recipientInvalid}
          </p>
        )}
      </div>

      <LocationPicker key={pickerResetKey} lang={lang} onChange={handleLocationChange} />
      {locationAlert !== null && (
        <p className="profile-error" role="alert">
          {locationAlert}
        </p>
      )}
      {location === null && locationAlert === null && graphemeCount > 0 && (
        <p className="profile-hint" role="note">
          {t.locationMissing}
        </p>
      )}

      {cooldownActive && (
        <p className="profile-note" role="status">
          {t.cooldown.replace('{seconds}', String(cooldownRemaining))}
        </p>
      )}

      {limitBlocked && (
        <div className="profile-error" role="alert">
          <p>
            <strong>{t.limitTitle}</strong> {t.limitText}
          </p>
          <Link href={`/${lang}/my-messages`}>{t.myMessages}</Link>
        </div>
      )}

      {accountError && (
        <p className="profile-error profile-error--general" role="alert">
          {t.accountUnavailable}
        </p>
      )}
      {genericError && (
        <p className="profile-error profile-error--general" role="alert">
          {t.genericError}
        </p>
      )}

      <div className="profile-actions">
        <button type="submit" className="profile-submit" disabled={publishDisabled}>
          {sending ? t.publishing : t.publish}
        </button>
        <button type="button" className="profile-cancel" disabled={sending} onClick={() => router.push(`/${lang}`)}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}
