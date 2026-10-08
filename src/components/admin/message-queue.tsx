'use client'

import { useActionState, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { moderateMessageAction, type ModerationActionState } from '@/app/(site)/admin/messages/actions'
import type { ModerationMessage } from '@/server/moderation/message-repository'
import type { ModerationDecision } from '@/domain/moderation/policies'
import { MODERATION_REASON_CODES, isModerationReasonCode } from '@/i18n/moderation-reasons'
import { AdminRefresh } from './admin-refresh'
import { AppSelect } from '@/components/ui/app-select'

function MessageDecisionForm({ message, onSaved }: { message: ModerationMessage; onSaved: () => void }) {
  const t = useTranslations('Pages.admin.moderation')
  const reasons = useTranslations('Forms.own')
  const id = useId()
  const [decision, setDecision] = useState<ModerationDecision>(message.decisions[0])
  const [state, action, pending] = useActionState<ModerationActionState, FormData>(async (previous, form) => {
    const result = await moderateMessageAction(previous, form)
    if (result.status === 'saved') onSaved()
    return result
  }, { status: 'idle' })
  const stale = state.status === 'conflict' || state.status === 'transition' || state.status === 'denied' || state.status === 'saved'
  return <form action={action} className="admin-decision-form">
    <input type="hidden" name="publicId" value={message.publicId} />
    <input type="hidden" name="expectedVersion" value={message.version} />
    <AppSelect variant="admin-messages" label={t('decision')} name="decision" value={decision} disabled={pending || stale} onChange={value => setDecision(value as ModerationDecision)} options={message.decisions.map(value => ({ value, label: t(`decisions.${value}`) }))} />
    {decision !== 'approve' && <>
      <AppSelect variant="admin-messages" label={t('reason')} name="reasonCode" placeholder={t('chooseReason')} required disabled={pending || stale} options={MODERATION_REASON_CODES.map(value => ({ value, label: reasons(`reasons.${value}`) }))} />
    </>}
    <label htmlFor={`${id}-note`}>{t('note')}</label>
    <textarea id={`${id}-note`} name="note" maxLength={1000} rows={3} disabled={pending || stale} />
    <button type="submit" disabled={pending || stale}>{pending ? t('saving') : t('apply')}</button>
    {state.status !== 'idle' && state.status !== 'saved' && <p role="alert">{t(state.status)}</p>}
    {(state.status === 'conflict' || state.status === 'transition') && <AdminRefresh />}
  </form>
}

export type ModerationQueueMessage = ModerationMessage & { publishedAtLabel: string }

export function MessageQueue({ messages }: { messages: ModerationQueueMessage[] }) {
  const t = useTranslations('Pages.admin.moderation')
  const own = useTranslations('Forms.own')
  const accounts = useTranslations('Pages.admin.states')
  const [saved, setSaved] = useState(false)
  return <>
    {saved && <p role="status">{t('saved')}</p>}
    {messages.length === 0 ? <p role="status">{t('empty')}</p> : <ul className="admin-message-list">
    {messages.map(message => <li key={message.publicId}>
      <article aria-label={t('letterBy', { name: message.authorName })}>
        <h3>{message.authorName}</h3>
        <p className="admin-badges"><span className="admin-badge" data-state={message.authorState}>{accounts(message.authorState)}</span><span className="admin-badge" data-state={message.status}>{own(`status.${message.status}`)}</span><span className="admin-message-version">{t('version', { version: message.version })}</span></p>
        <p className="admin-message-content">{message.content}</p>
        <p>{[message.locality, message.country].filter(Boolean).join(', ')}</p>
        <time dateTime={message.publishedAt}>{message.publishedAtLabel} UTC</time>
        <p>{t(message.publicVisible ? 'public' : 'hidden')}</p>
        <small>{t('letterId')}: {message.publicId}</small>
        {message.reasonCode && <p>{isModerationReasonCode(message.reasonCode) ? own(`reasons.${message.reasonCode}`) : own('reasonFallback')}</p>}
        {message.note && <p>{message.note}</p>}
      </article>
      {message.decisions.length > 0 ? <MessageDecisionForm key={`${message.publicId}-${message.version}-${message.decisions.join(',')}`} message={message} onSaved={() => setSaved(true)} /> : <p className="profile-note">{t('noDecisions')}</p>}
    </li>)}
    </ul>}
  </>
}
