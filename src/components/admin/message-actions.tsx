'use client'

import { useActionState, useId, useState } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { useTranslations } from 'next-intl'
import { moderateMessageAction, type ModerationActionState } from '@/app/(site)/admin/messages/actions'
import type { ModerationMessage } from '@/server/moderation/message-repository'
import type { ModerationDecision } from '@/domain/moderation/policies'
import { MODERATION_REASON_CODES } from '@/i18n/moderation-reasons'
import { AppSelect } from '@/components/ui/app-select'
import { AdminDisclosure } from './admin-disclosure'
import { AdminRefresh } from './admin-refresh'
import { AdminSpinner } from './admin-spinner'

export function MessageActions({ message, onSaved }: { message: ModerationMessage; onSaved: () => void }) {
  const t = useTranslations('Pages.admin.moderation')
  const reasons = useTranslations('Forms.own')
  const id = useId()
  const [decision, setDecision] = useState<ModerationDecision>(message.decisions[0])
  const [view, setView] = useState<'list' | 'reject' | 'saved'>('list')
  const [state, action, pending] = useActionState<ModerationActionState, FormData>(async (previous, form) => {
    if (form.get('decision') === 'reject' && !form.get('reasonCode')) form.set('reasonCode', 'community_guidelines')
    const result = await moderateMessageAction(previous, form)
    if (result.status === 'saved') {
      // Revalidation may remove this letter before the action state commits.
      setView('saved')
      onSaved()
    }
    return result
  }, { status: 'idle' })
  const stale = state.status === 'conflict' || state.status === 'transition' || state.status === 'denied' || state.status === 'saved' || view === 'saved'
  const disabled = pending || stale
  const rejectionVisible = view === 'reject'
  const saving = pending && view !== 'saved'
  const identityFields = <>
    <input type="hidden" name="publicId" value={message.publicId} />
    <input type="hidden" name="expectedVersion" value={message.version} />
  </>
  const feedback = <>
    {saving && <p role="status" className="admin-saving"><AdminSpinner />{t('saving')}</p>}
    {state.status !== 'idle' && state.status !== 'saved' && <p role="alert">{t(state.status)}</p>}
    {(state.status === 'conflict' || state.status === 'transition') && <AdminRefresh />}
  </>
  return <div className="admin-message-actions" aria-busy={saving}>
    {message.status === 'pending' && <div className="admin-quick-actions">
      {message.decisions.includes('approve') && <form action={action}>
        {identityFields}<input type="hidden" name="decision" value="approve" />
        <button type="submit" disabled={disabled}>{saving && <AdminSpinner />}{t('decisions.approve')}</button>
      </form>}
      {message.decisions.includes('reject') && <button type="button" className="admin-reject-button" disabled={disabled} onClick={() => setView('reject')}>{t('decisions.reject')}</button>}
    </div>}
    <AdminDisclosure label={t('moreOptions')} context={message.authorName} disabled={pending}>
      <form action={action} className="admin-decision-form">
        {identityFields}
        <AppSelect variant="admin-messages" label={t('decision')} name="decision" value={decision} disabled={disabled} onChange={value => setDecision(value as ModerationDecision)} options={message.decisions.map(value => ({ value, label: t(`decisions.${value}`) }))} />
        {decision !== 'approve' && <AppSelect variant="admin-messages" label={t('reason')} name="reasonCode" placeholder={t('chooseReason')} required disabled={disabled} options={MODERATION_REASON_CODES.map(value => ({ value, label: reasons(`reasons.${value}`) }))} />}
        <label htmlFor={`${id}-note`}>{t('note')}</label>
        <textarea id={`${id}-note`} name="note" maxLength={1000} rows={3} disabled={disabled} />
        <button type="submit" disabled={disabled}>{saving && <AdminSpinner />}{saving ? t('saving') : t('apply')}</button>
      </form>
    </AdminDisclosure>
    {!rejectionVisible && feedback}
    <ModalOverlay className="admin-modal-overlay" isOpen={rejectionVisible} onOpenChange={open => { if (!pending) setView(open ? 'reject' : 'list') }} isDismissable={!pending} isKeyboardDismissDisabled={pending}>
      <Modal className="admin-panel admin-section admin-section--messages admin-rejection-modal">
        <Dialog className="admin-rejection-dialog">
          <Heading slot="title">{t('rejectTitle')}</Heading>
          <p>{t('rejectConfirm', { name: message.authorName })}</p>
          <form action={action} className="admin-decision-form">
            {identityFields}<input type="hidden" name="decision" value="reject" />
            <AppSelect variant="admin-messages" label={t('optionalReason')} name="reasonCode" placeholder={t('chooseReason')} disabled={disabled} options={MODERATION_REASON_CODES.map(value => ({ value, label: reasons(`reasons.${value}`) }))} />
            <p className="admin-field-hint">{t('defaultReasonHint', { reason: reasons('reasons.community_guidelines') })}</p>
            <label htmlFor={`${id}-reject-note`}>{t('note')}</label>
            <textarea id={`${id}-reject-note`} name="note" maxLength={1000} rows={3} disabled={disabled} />
            {feedback}
            <div className="admin-dialog-actions">
              <button type="button" className="admin-cancel-button" disabled={pending} onClick={() => setView('list')}>{t('cancel')}</button>
              <button type="submit" className="admin-reject-button" disabled={disabled}>{saving && <AdminSpinner />}{saving ? t('saving') : t('confirmRejection')}</button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </div>
}
