'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import type { PublicMessageDetail } from '@/domain/messages/public-message'
import type { OwnMessage } from '@/domain/messages/own-message'
import { LocationPicker } from '@/components/map/location-picker'
import { EditMessageForm } from './edit-message-form'
import { LetterWorkspace } from './letter-workspace'

export function LetterDetail({ message, ownMessage }: { message: PublicMessageDetail; ownMessage?: OwnMessage }) {
  const [editing, setEditing] = useState(false)
  const router = useRouter()
  const t = useTranslations('Forms')
  const format = useFormatter()

  if (editing && ownMessage) {
    return <EditMessageForm message={ownMessage} onCancel={() => setEditing(false)} onSaved={() => {
      setEditing(false)
      router.refresh()
    }} />
  }

  return (
    <div className="profile-form">
      <LetterWorkspace content={
        <article className="letter-reading">
          <p className="letter-reading__content">{message.content}</p>
          <footer>
            <p>{message.author.displayName}</p>
            <time dateTime={message.publishedAt}>{format.dateTime(new Date(message.publishedAt), { dateStyle: 'long', timeZone: 'UTC' })}</time>
          </footer>
        </article>
      } properties={
        <>
          <LocationPicker readOnly initialLocation={message} content={message.content} onChange={() => {}} />
          {ownMessage ? <p className="profile-note">{t(`own.status.${ownMessage.status}`)}</p> : null}
        </>
      } />
      <div className="letter-workspace__feedback" />
      {ownMessage ? <div className="profile-actions"><button className="profile-submit" type="button" onClick={() => setEditing(true)}>{t('own.edit')}</button></div> : null}
    </div>
  )
}
