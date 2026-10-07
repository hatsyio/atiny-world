'use client'

import { LetterWorkspace } from './letter-workspace'
import type { Locale } from '@/i18n/locale'

import { useLocale, useTranslations } from 'next-intl'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createMessageAction, type CreateMessageActionResult } from '@/app/(site)/actions/create-message'
import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'
import { returnDestination } from '@/components/navigation/return-destination'
import { errorResult } from '@/domain/contracts'
import { MAX_GRAPHEMES, countGraphemes } from '@/domain/messages/content'
import type { CreateMessageActionInput } from '@/server/actions/create-message'


export type CreateMessageSubmit = (
  input: CreateMessageActionInput,
) => Promise<CreateMessageActionResult>

export type FormFieldErrors = {
  content?: 'required' | 'tooLong'
  location?: 'required' | 'expired' | 'invalid'
}

export interface CreateMessageFormProps {
  lang?: Locale
  returnTo?: string
  onPublished?: (publicId: string, publicVisible: boolean) => void
  submitMessage?: CreateMessageSubmit
}

type PublishState = {
  result: CreateMessageActionResult | null
  published: Extract<CreateMessageActionResult, { ok: true }>['data'] | null
}

export function CreateMessageForm({
  onPublished,
  returnTo,
  submitMessage = createMessageAction,
}: CreateMessageFormProps) {
  const lang = useLocale()
  const t = useTranslations('Forms.create')
  const origin = returnDestination(lang, returnTo)
  const router = useRouter()

  const [content, setContent] = useState('')
  const [location, setLocation] = useState<LocationPickerSelection | null>(null)
  const [pickerResetKey, setPickerResetKey] = useState(0)
  // Block same-turn submits before React renders pending; Actions otherwise queue them.
  const submissionInFlight = useRef(false)
  const [state, publish, sending] = useActionState<PublishState, CreateMessageActionInput>(handlePublish, {
    result: null, published: null,
  })
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({})
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const errorCode = state.result?.ok === false ? state.result.error.code : null
  const limitBlocked = errorCode === 'MESSAGE_LIMIT_REACHED'
  const accountError = errorCode === 'PROFILE_INCOMPLETE' || errorCode === 'ACCOUNT_SUSPENDED' || errorCode === 'NOT_FOUND'
  const genericError = errorCode !== null && !['MESSAGE_LIMIT_REACHED', 'MESSAGE_COOLDOWN_ACTIVE', 'VALIDATION_ERROR', 'LOCATION_SELECTION_REQUIRED', 'LOCATION_SELECTION_EXPIRED', 'LOCATION_SELECTION_INVALID', 'PROFILE_INCOMPLETE', 'ACCOUNT_SUSPENDED', 'NOT_FOUND'].includes(errorCode)

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

  function handleLocationChange(next: LocationPickerSelection | null) {
    setLocation(next)
    setFieldErrors((errors) => (errors.location === undefined ? errors : { ...errors, location: undefined }))
  }

  function applySubmitError(
    error: Extract<CreateMessageActionResult, { ok: false }>['error'],
  ) {
    switch (error.code) {
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
    }
  }

  async function handlePublish(previous: PublishState, input: CreateMessageActionInput): Promise<PublishState> {
    setFieldErrors({})
    try {
      const result = await submitMessage(input)
      startTransition(() => {
        if (result.ok) {
          onPublished?.(result.data.publicId, result.data.publicVisible)
          setContent('')
          setLocation(null)
          setPickerResetKey((key) => key + 1)
        } else {
          applySubmitError(result.error)
        }
      })
      return { result, published: result.ok ? result.data : previous.published }
    } catch {
      return { ...previous, result: errorResult('INTERNAL_ERROR', { messageKey: 'error.internal' }) }
    } finally {
      submissionInFlight.current = false
    }
  }

  const contentAlert =
    fieldErrors.content === 'required' ? t('contentRequired')
      : contentTooLong || fieldErrors.content === 'tooLong' ? t('contentTooLong')
        : null
  const locationAlert =
    fieldErrors.location === 'required' ? t('locationRequired')
      : fieldErrors.location === 'expired' ? t('locationExpired')
        : fieldErrors.location === 'invalid' ? t('locationInvalid')
          : null
  const descriptionId = contentAlert !== null ? 'message-counter message-content-error' : 'message-counter'

  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (submissionInFlight.current || publishDisabled || location === null) return
        submissionInFlight.current = true
        startTransition(() => publish({ content, location }))
      }}
    >
      {state.published !== null && (
        <p className="profile-note" role="status">
          <strong>{t('publishedTitle')}</strong> {state.published.publicVisible ? t('publishedVisibleText') : t('publishedText')}
        </p>
      )}

      <LetterWorkspace content={
        <div className="profile-field">
          <label htmlFor="message-content">{t('contentLabel')}</label>
          <textarea
            id="message-content"
            name="content"
            rows={8}
            value={content}
            placeholder={t('contentPlaceholder')}
            aria-invalid={contentAlert !== null}
            aria-describedby={descriptionId}
            onChange={(event) => {
              setContent(event.target.value)
              setFieldErrors((errors) => (errors.content === undefined ? errors : { ...errors, content: undefined }))
            }}
          />
          <p id="message-counter" className="message-counter" aria-live="polite">
            {t('counter', {count: graphemeCount, max: MAX_GRAPHEMES})}
          </p>
          {contentAlert !== null && (
            <p id="message-content-error" className="profile-error" role="alert">
              {contentAlert}
            </p>
          )}
        </div>

      } properties={<>
        <LocationPicker key={pickerResetKey} lang={lang} onChange={handleLocationChange} />
        <div className="letter-workspace__property-feedback">
        {locationAlert !== null && (
          <p className="profile-error" role="alert">
            {locationAlert}
          </p>
        )}
        {location === null && locationAlert === null && graphemeCount > 0 && (
          <p className="profile-hint" role="note">
            {t('locationMissing')}
          </p>
        )}

        </div>
      </>} />

      <div className="letter-workspace__feedback">
        {cooldownActive && (
          <p className="profile-note" role="status">
            {t('cooldown', {seconds: cooldownRemaining})}
          </p>
        )}

        {limitBlocked && (
          <div className="profile-error" role="alert">
            <p>
              <strong>{t('limitTitle')}</strong> {t('limitText')}
            </p>
            <Link href={'/my-messages'}>{t('myMessages')}</Link>
          </div>
        )}

        {!sending && accountError && (
          <p className="profile-error profile-error--general" role="alert">
            {t('accountUnavailable')}
          </p>
        )}
        {!sending && genericError && (
          <p className="profile-error profile-error--general" role="alert">
            {t('genericError')}
          </p>
        )}

      </div>
      <div className="profile-actions">
        <button type="submit" className="profile-submit" disabled={publishDisabled}>
          {sending ? t('publishing') : t('publish')}
        </button>
        <button type="button" className="profile-cancel" disabled={sending} onClick={() => router.push(origin.href)}>
          {origin.cancel}
        </button>
      </div>
    </form>
  )
}
