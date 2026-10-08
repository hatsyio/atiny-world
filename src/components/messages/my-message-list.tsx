'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { useQueryClient } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { LetterLink } from '@/components/navigation/letter-link'
import { ownLetterOrigin } from '@/components/navigation/letter-origin'
import type { MessageStatus } from '@/domain/contracts'
import type { OwnMessage } from '@/domain/messages/own-message'
import { isModerationReasonCode } from '@/i18n/moderation-reasons'
import { deleteMessageAction } from '@/app/(site)/my-messages/delete-action'

export type OwnMessageListItem = Pick<
  OwnMessage,
  'publicId' | 'version' | 'status' | 'moderationReasonCode' | 'moderationNote' | 'content'
> &
  Partial<Pick<OwnMessage, 'point' | 'precision' | 'locality' | 'country' | 'publishedAt'>> & { publicVisible?: boolean }

type Props = {
  cursor?: string
  messages: OwnMessageListItem[]
  accountSuspended?: boolean
  onDelete?: (publicId: string, expectedVersion: number) => void | Promise<void>
  onEdit?: (publicId: string, expectedVersion: number) => void | Promise<void>
}


function DefaultEditButton({ item, disabled, label }: {
  item: OwnMessageListItem
  disabled: boolean
  label: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push(`/my-messages/${item.publicId}/edit`)}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export function MyMessageList({
  cursor,
  messages,
  accountSuspended = false,
  onDelete,
  onEdit,
}: Props) {
  const queryClient = useQueryClient()
  const t = useTranslations('Forms.own')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copyFeedback, setCopyFeedback] = useState<{ publicId: string; key: 'copied' | 'copyError' } | null>(null)

  async function copyLink(publicId: string) {
    setCopyFeedback(null)
    try {
      await navigator.clipboard.writeText(new URL(`/messages/${encodeURIComponent(publicId)}`, window.location.origin).href)
      setCopyFeedback({ publicId, key: 'copied' })
    } catch {
      setCopyFeedback({ publicId, key: 'copyError' })
    }
  }

  function edit(item: OwnMessageListItem) {
    if (onEdit) {
      void onEdit(item.publicId, item.version)
      return
    }
  }

  function remove(item: OwnMessageListItem) {
    setError(null)
    startTransition(async () => {
      if (onDelete) {
        await onDelete(item.publicId, item.version)
        void queryClient.resetQueries({ queryKey: publicMapQueryKey })
        setConfirming(null)
        return
      }

      const result = await deleteMessageAction({
        publicId: item.publicId,
        expectedVersion: item.version,
        confirmation: true,
      })
      if (!result.ok) {
        setError('deleteError')
        return
      }
      setConfirming(null)
      void queryClient.resetQueries({ queryKey: publicMapQueryKey })
      window.location.reload()
    })
  }

  return (
    <section className="my-messages" aria-label={t('listLabel')}>
      {error ? <p role="alert">{t('deleteError')}</p> : null}
      {messages.length === 0 ? <p role="status">{t('empty')}</p> : null}
      {messages.length > 0 ? (
        <ul className="my-message-list">
          {messages.map((item, index) => {
            const reason = item.moderationReasonCode ? (isModerationReasonCode(item.moderationReasonCode) ? t(`reasons.${item.moderationReasonCode}`) : t('reasonFallback')) : null
            const isConfirming = confirming === item.publicId
            const origin = ownLetterOrigin(item.publicId, cursor)
            const publicVisible = item.publicVisible === true && !accountSuspended

            return (
              <li id={`own-${item.publicId}`} className="my-message-item" key={`${item.publicId}-${index}`} aria-label={item.content}>
                <p className="my-message-content">{item.content}</p>
                <p><strong>{t(`status.${item.status as MessageStatus}`)}</strong></p>
                {reason ? <p><span>{reason}</span></p> : null}
                {item.moderationNote ? <p><small><span>{t('moderationNote')}: </span><span>{item.moderationNote}</span></small></p> : null}
                <p className="my-message-links">
                  <LetterLink publicId={item.publicId} origin={origin}>{t('view')}</LetterLink>
                  {publicVisible ? <>
                    <Link href={`/?letter=${encodeURIComponent(item.publicId)}#map`}>{t('viewMap')}</Link>
                    <button type="button" onClick={() => void copyLink(item.publicId)}>{t('copyLink')}</button>
                  </> : null}
                </p>
                {!publicVisible ? <p className="profile-note">{t(accountSuspended ? 'privateSuspended' : item.status === 'pending' ? 'privatePending' : 'privateHidden')}</p> : null}
                {copyFeedback?.publicId === item.publicId ? <p role="status">{t(copyFeedback.key)}</p> : null}
                <div className="my-message-actions">
                  {!accountSuspended ? (
                    onEdit ? (
                      <button type="button" onClick={() => edit(item)} disabled={isPending}>{t('edit')}</button>
                    ) : (
                      <DefaultEditButton item={item} disabled={isPending} label={t('edit')} />
                    )
                  ) : null}
                  {!isConfirming ? (
                    <button type="button" onClick={() => setConfirming(item.publicId)} disabled={isPending}>{t('delete')}</button>
                  ) : (
                    <div role="group" aria-label={t('confirm')}>
                      <p>{t('confirmHint')}</p>
                      <button type="button" onClick={() => remove(item)} disabled={isPending}>{t('confirm')}</button>
                      <button type="button" onClick={() => setConfirming(null)} disabled={isPending}>{t('keep')}</button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
