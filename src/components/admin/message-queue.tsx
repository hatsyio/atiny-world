'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ModerationMessage } from '@/server/moderation/message-repository'
import { isModerationReasonCode } from '@/i18n/moderation-reasons'
import { MessageActions } from './message-actions'

export type ModerationQueueMessage = ModerationMessage & { publishedAtLabel: string }

export function MessageQueue({ messages }: { messages: ModerationQueueMessage[] }) {
  const t = useTranslations('Pages.admin.moderation')
  const own = useTranslations('Forms.own')
  const accounts = useTranslations('Pages.admin.states')
  const [saved, setSaved] = useState(false)
  const onSaved = useCallback(() => setSaved(true), [])
  return <>
    {saved && <p role="status">{t('saved')}</p>}
    {messages.length === 0 ? <p role="status">{t('empty')}</p> : <ul className="admin-message-list">
    {messages.map(message => <li key={message.publicId}>
      <article aria-label={t('letterBy', { name: message.authorName })}>
        <header className="admin-message-header">
          <h3>{message.authorName}</h3>
          <p className="admin-badges"><span className="admin-badge" data-state={message.authorState}>{accounts(message.authorState)}</span><span className="admin-badge" data-state={message.status}>{own(`status.${message.status}`)}</span><span className="admin-message-version">{t('version', { version: message.version })}</span></p>
          <div className="admin-message-meta"><span>{[message.locality, message.country].filter(Boolean).join(', ')}</span><time dateTime={message.publishedAt}>{message.publishedAtLabel} UTC</time><span>{t(message.publicVisible ? 'public' : 'hidden')}</span></div>
        </header>
        <p className="admin-message-content">{message.content}</p>
        <small>{t('letterId')}: {message.publicId}</small>
        {message.reasonCode && <p>{isModerationReasonCode(message.reasonCode) ? own(`reasons.${message.reasonCode}`) : own('reasonFallback')}</p>}
        {message.note && <p>{message.note}</p>}
      </article>
      {message.decisions.length > 0 ? <MessageActions key={`${message.publicId}-${message.version}-${message.decisions.join(',')}`} message={message} onSaved={onSaved} /> : <p className="profile-note">{t('noDecisions')}</p>}
    </li>)}
    </ul>}
  </>
}
