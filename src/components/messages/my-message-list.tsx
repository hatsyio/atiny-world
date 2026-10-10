'use client'

import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

import { useQueryClient } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { useId, useState, useTransition } from 'react'

import { LetterLink } from '@/components/navigation/letter-link'
import { ownLetterOrigin } from '@/components/navigation/letter-origin'
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
}


export function MyMessageList({
  cursor,
  messages,
  accountSuspended = false,
  onDelete,
}: Props) {
  const queryClient = useQueryClient()
  const t = useTranslations('Forms.own')
  const format = useFormatter()
  const confirmationId = useId()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedMessage = messages.find(item => item.publicId === confirming)

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
      {messages.length === 0 ? <p role="status">{t('empty')}</p> : null}
      {messages.length > 0 ? (
        <ul className="my-message-list">
          {messages.map((item, index) => {
            const reason = item.moderationReasonCode ? (isModerationReasonCode(item.moderationReasonCode) ? t(`reasons.${item.moderationReasonCode}`) : t('reasonFallback')) : null
            const origin = ownLetterOrigin(item.publicId, cursor)
            const publicVisible = item.publicVisible === true && !accountSuspended

            return (
              <li id={`own-${item.publicId}`} className="my-message-item" key={`${item.publicId}-${index}`} aria-label={item.content}>
                <header className="my-message-meta">
                  <span className="my-message-status" data-status={item.status}>{t(`status.${item.status}`)}</span>
                  {[item.locality, item.country].filter(Boolean).length > 0 ? <span>{[item.locality, item.country].filter(Boolean).join(', ')}</span> : null}
                  {item.publishedAt ? <time dateTime={item.publishedAt}>{format.dateTime(new Date(item.publishedAt), { dateStyle: 'medium', timeZone: 'UTC' })}</time> : null}
                </header>
                <p className="my-message-content">{item.content}</p>
                {reason ? <p><span>{reason}</span></p> : null}
                {item.moderationNote ? <p><small><span>{t('moderationNote')}: </span><span>{item.moderationNote}</span></small></p> : null}
                {!publicVisible ? <p className="my-message-note">{t(accountSuspended ? 'privateSuspended' : item.status === 'pending' ? 'privatePending' : 'privateHidden')}</p> : null}
                <div className="my-message-links">
                  <LetterLink className="my-message-view" publicId={item.publicId} origin={origin}>{t('view')}</LetterLink>
                  {publicVisible ? <Link className="my-message-map" href={`/?letter=${encodeURIComponent(item.publicId)}#map`}>{t('viewMap')}</Link> : null}
                  <button
                    className="my-message-delete"
                    type="button"
                    disabled={isPending}
                    onClick={() => { setError(null); setConfirming(item.publicId) }}
                  >{t('delete')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <ModalOverlay
        className="my-message-modal-overlay"
        isOpen={Boolean(selectedMessage)}
        onOpenChange={open => { if (!open && !isPending) setConfirming(null) }}
        isDismissable={!isPending}
        isKeyboardDismissDisabled={isPending}
      >
        <Modal className="my-message-modal">
          <Dialog className="my-message-dialog" role="alertdialog" aria-describedby={confirmationId} aria-busy={isPending}>
            <Heading slot="title">{t('delete')}</Heading>
            <p id={confirmationId}>{t('confirmHint')}</p>
            {error ? <p role="alert">{t('deleteError')}</p> : null}
            <div className="my-message-confirm">
              <Button autoFocus onPress={() => setConfirming(null)} isDisabled={isPending}>{t('keep')}</Button>
              <Button className="my-message-delete" onPress={() => { if (selectedMessage) remove(selectedMessage) }} isDisabled={isPending}>{t('confirm')}</Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </section>
  )
}
