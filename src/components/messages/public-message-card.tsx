import type { PublicMessageDetail } from '@/domain/messages/public-message'

interface Props {
  message: PublicMessageDetail | null
}

function locationLabel(message: PublicMessageDetail): string {
  return [message.locality, message.country].filter(Boolean).join(', ')
}

export function PublicMessageCard({ message }: Props) {
  if (!message) {
    return <p role="status">Este mensaje no está disponible.</p>
  }

  return (
    <article className="public-message-card" aria-label="Mensaje público">
      <p>{message.content}</p>
      <p>{message.author.displayName}</p>
      <p>{locationLabel(message)}</p>
      <time dateTime={message.publishedAt}>
        {new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(
          new Date(message.publishedAt),
        )}
      </time>
    </article>
  )
}
