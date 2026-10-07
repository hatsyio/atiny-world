'use client'

import { LetterWorkspace } from './letter-workspace'
import type { Locale } from '@/i18n/locale'

import { useTranslations } from 'next-intl'

import { useQueryClient } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { startTransition, useActionState, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateMessageAction,
  type UpdateMessageActionResult,
} from '@/app/(site)/my-messages/actions'
import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'
import { errorResult } from '@/domain/contracts'
import { MAX_GRAPHEMES, countGraphemes } from '@/domain/messages/content'
import type { OwnMessage } from '@/domain/messages/own-message'
import type { UpdateMessageActionInput } from '@/server/actions/update-message'

export type EditMessageSubmit = (
  input: UpdateMessageActionInput,
) => Promise<UpdateMessageActionResult>

export interface EditMessageFormProps {
  lang?: Locale
  message: Pick<OwnMessage, 'publicId' | 'version' | 'content' | 'country' | 'precision' | 'locality'> & Partial<Pick<OwnMessage, 'point'>>
  onSaved?: () => void
  onCancel?: () => void
  submitUpdate?: EditMessageSubmit
}


export function EditMessageForm({
  message,
  onSaved,
  onCancel,
  submitUpdate = updateMessageAction,
}: EditMessageFormProps) {
  const t = useTranslations('Forms.edit')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [content, setContent] = useState(message.content)
  const [location, setLocation] = useState<LocationPickerSelection | null>(null)
  const [locationPending, setLocationPending] = useState(false)
  // Block same-turn submits before React renders pending; Actions otherwise queue them.
  const submissionInFlight = useRef(false)
  const [result, save, saving] = useActionState<UpdateMessageActionResult | null, UpdateMessageActionInput>(handleUpdate, null)
  const error = result?.ok === false ? updateError(result.error.code) : null
  const characterCount = countGraphemes(content)
  const invalidContent = characterCount === 0 || characterCount > MAX_GRAPHEMES

  async function handleUpdate(_previous: UpdateMessageActionResult | null, input: UpdateMessageActionInput): Promise<UpdateMessageActionResult> {
    try {
      const result = await submitUpdate(input)
      if (result.ok) {
        startTransition(() => {
          void queryClient.resetQueries({ queryKey: publicMapQueryKey })
          if (onSaved) onSaved()
          else router.push('/my-messages')
        })
      }
      return result
    } catch {
      return errorResult('INTERNAL_ERROR', { messageKey: 'error.internal' })
    } finally {
      submissionInFlight.current = false
    }
  }

  return (
    <form className="profile-form" onSubmit={(event) => {
      event.preventDefault()
      if (submissionInFlight.current || saving || invalidContent || locationPending) return
      submissionInFlight.current = true
      startTransition(() => save({
        publicId: message.publicId,
        expectedVersion: message.version,
        content,
        ...(location !== null ? { location } : {}),
      }))
    }}>
      <LetterWorkspace content={
        <div className="profile-field">
          <label htmlFor="edit-message-content">{t('content')}</label>
          <textarea
            id="edit-message-content"
            name="content"
            rows={8}
            value={content}
            placeholder={t('contentPlaceholder')}
            aria-describedby="edit-message-counter"
            aria-invalid={invalidContent}
            onChange={(event) => setContent(event.target.value)}
          />
          <p id="edit-message-counter" className="message-counter" aria-live="polite">
            {t('counter', {count: characterCount, max: MAX_GRAPHEMES})}
          </p>
        </div>

      } properties={
        <LocationPicker initialLocation={message} onChange={setLocation} onPendingChange={setLocationPending} />
      } />

      <div className="letter-workspace__feedback">
        {!saving && error ? <p className="profile-error profile-error--general" role="alert">{t(error)}</p> : null}
      </div>
      <div className="profile-actions">
        <button type="submit" className="profile-submit" disabled={saving || invalidContent || locationPending}>
          {saving ? t('saving') : t('save')}
        </button>
        <button
          type="button"
          className="profile-cancel"
          disabled={saving}
          onClick={() => onCancel ? onCancel() : router.push('/my-messages')}
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}


function updateError(code: Extract<UpdateMessageActionResult, { ok: false }>['error']['code']) {
  switch (code) {
    case 'MESSAGE_VERSION_CONFLICT': return 'conflict'
    case 'NOT_FOUND': return 'unavailable'
    case 'ACCOUNT_SUSPENDED': return 'suspended'
    case 'VALIDATION_ERROR':
    case 'LOCATION_SELECTION_REQUIRED':
    case 'LOCATION_SELECTION_EXPIRED':
    case 'LOCATION_SELECTION_INVALID': return 'invalid'
    default: return 'error'
  }
}
