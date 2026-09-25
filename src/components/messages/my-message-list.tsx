'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { MessageStatus } from '@/domain/contracts'
import type { OwnMessage } from '@/domain/messages/own-message'
import { deleteMessageAction } from '@/app/[lang]/my-messages/delete-action'

export type OwnMessageListItem = Pick<
  OwnMessage,
  'publicId' | 'version' | 'status' | 'moderationReasonCode' | 'moderationNote' | 'content'
> &
  Partial<Pick<OwnMessage, 'point' | 'precision' | 'locality' | 'country' | 'publishedAt'>>

type Locale = 'en' | 'es'

type Props = {
  lang?: string
  messages: OwnMessageListItem[]
  accountSuspended?: boolean
  onDelete?: (publicId: string, expectedVersion: number) => void | Promise<void>
  onEdit?: (publicId: string, expectedVersion: number) => void | Promise<void>
}

const copy = {
  en: {
    listLabel: 'Your letters',
    status: {
      pending: 'Pending review',
      approved: 'Approved',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn',
    },
    reasons: {
      spam: 'Spam or unsolicited content',
      conduct: 'Harassment or misconduct',
    },
    reasonFallback: 'Moderation reason',
    moderationNote: 'Private moderation note',
    locate: 'Locate letter',
    unavailable: 'Public link unavailable',
    edit: 'Edit letter',
    delete: 'Delete letter',
    confirm: 'Confirm deletion',
    keep: 'Keep letter',
    confirmHint: 'This letter will be deleted permanently. This frees one slot of your limit and cannot be undone.',
    deleteError: 'The letter could not be deleted. Please try again.',
  },
  es: {
    listLabel: 'Tus cartas',
    status: {
      pending: 'Pendiente de revisión',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      withdrawn: 'Retirado',
    },
    reasons: {
      spam: 'Contenido no deseado',
      conduct: 'Acoso o mala conducta',
    },
    reasonFallback: 'Motivo de moderación',
    moderationNote: 'Nota privada de moderación',
    locate: 'Localizar carta',
    unavailable: 'Enlace público no disponible',
    edit: 'Editar carta',
    delete: 'Eliminar carta',
    confirm: 'Confirmar eliminación',
    keep: 'Conservar carta',
    confirmHint: 'Esta carta se eliminará de forma permanente. Libera un hueco de tu límite y no se puede deshacer.',
    deleteError: 'No se pudo eliminar la carta. Inténtalo de nuevo.',
  },
} as const

function reasonLabel(locale: Locale, code: string | null): string | null {
  if (!code) return null
  return copy[locale].reasons[code as keyof typeof copy.en.reasons] ?? copy[locale].reasonFallback
}

function DefaultEditButton({ item, lang, disabled, label }: {
  item: OwnMessageListItem
  lang: Locale
  disabled: boolean
  label: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push(`/${lang}/my-messages/${item.publicId}/edit`)}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

export function MyMessageList({
  lang = 'en',
  messages,
  accountSuspended = false,
  onDelete,
  onEdit,
}: Props) {
  const locale: Locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
        setConfirming(null)
        return
      }

      const result = await deleteMessageAction({
        publicId: item.publicId,
        expectedVersion: item.version,
        confirmation: true,
      })
      if (!result.ok) {
        setError(t.deleteError)
        return
      }
      setConfirming(null)
      window.location.reload()
    })
  }

  return (
    <section className="my-messages" aria-label={t.listLabel}>
      {error ? <p role="alert">{error}</p> : null}
      {messages.length === 0 ? <p role="status">{locale === 'es' ? 'Todavía no tienes cartas.' : 'You do not have any letters yet.'}</p> : null}
      {messages.length > 0 ? (
        <ul className="my-message-list">
          {messages.map((item, index) => {
            const reason = reasonLabel(locale, item.moderationReasonCode)
            const isConfirming = confirming === item.publicId
            const publicHref = `/${locale}/messages/${item.publicId}`

            return (
              <li className="my-message-item" key={`${item.publicId}-${index}`} aria-label={item.content}>
                <p className="my-message-content">{item.content}</p>
                <p><strong>{t.status[item.status as MessageStatus]}</strong></p>
                {reason ? <p><span>{reason}</span></p> : null}
                {item.moderationNote ? <p><small><span>{t.moderationNote}: </span><span>{item.moderationNote}</span></small></p> : null}
                <p className="my-message-links">
                  {item.status === 'approved' ? (
                    <Link href={publicHref}>{t.locate}</Link>
                  ) : (
                    <Link href={publicHref}>{t.unavailable}</Link>
                  )}
                </p>
                <div className="my-message-actions">
                  {!accountSuspended ? (
                    onEdit ? (
                      <button type="button" onClick={() => edit(item)} disabled={isPending}>{t.edit}</button>
                    ) : (
                      <DefaultEditButton item={item} lang={locale} disabled={isPending} label={t.edit} />
                    )
                  ) : null}
                  {!isConfirming ? (
                    <button type="button" onClick={() => setConfirming(item.publicId)} disabled={isPending}>{t.delete}</button>
                  ) : (
                    <div role="group" aria-label={t.confirm}>
                      <p>{t.confirmHint}</p>
                      <button type="button" onClick={() => remove(item)} disabled={isPending}>{t.confirm}</button>
                      <button type="button" onClick={() => setConfirming(null)} disabled={isPending}>{t.keep}</button>
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
