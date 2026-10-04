'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { PublicMessageDetail } from '@/domain/messages/public-message'

interface Props {
  message: PublicMessageDetail | null
}

function locationLabel(message: PublicMessageDetail): string {
  return [message.locality, message.country].filter(Boolean).join(', ')
}

export function PublicMessageCard({ message }: Props) {
  const t = useTranslations('Map.public')
  const format = useFormatter()
  if (!message) {
    return <p role="status">{t('unavailable')}</p>
  }

  return (
    <article className="public-message-card" aria-label={t('label')}>
      <p>{message.content}</p>
      <p>{message.author.displayName}</p>
      <p>{locationLabel(message)}</p>
      <time dateTime={message.publishedAt}>
        {format.dateTime(new Date(message.publishedAt), { dateStyle: 'long', timeZone: 'UTC' })}
      </time>
    </article>
  )
}
