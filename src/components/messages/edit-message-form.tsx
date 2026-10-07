'use client'

import { LetterWorkspace } from './letter-workspace'
import type { Locale } from '@/i18n/locale'

import { useTranslations } from 'next-intl'

import { useQueryClient } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateMessageAction,
  type UpdateMessageActionResult,
} from '@/app/(site)/my-messages/actions'
import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<'conflict' | 'unavailable' | 'suspended' | 'invalid' | 'error' | null>(null)
  const characterCount = countGraphemes(content)
  const invalidContent = characterCount === 0 || characterCount > MAX_GRAPHEMES

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || invalidContent || locationPending) return

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
        void queryClient.resetQueries({ queryKey: publicMapQueryKey })
        if (onSaved) onSaved()
        else router.push('/my-messages')
        return
      }

      switch (result.error.code) {
        case 'MESSAGE_VERSION_CONFLICT':
          setError('conflict')
          break
        case 'NOT_FOUND':
          setError('unavailable')
          break
        case 'ACCOUNT_SUSPENDED':
          setError('suspended')
          break
        case 'VALIDATION_ERROR':
        case 'LOCATION_SELECTION_REQUIRED':
        case 'LOCATION_SELECTION_EXPIRED':
        case 'LOCATION_SELECTION_INVALID':
          setError('invalid')
          break
        default:
          setError('error')
          break
      }
    } catch {
      setError('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
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
        {error ? <p className="profile-error profile-error--general" role="alert">{t(error)}</p> : null}
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
