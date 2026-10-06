'use client'

import { useActionState, useId } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { setSuspensionAction, type SuspensionActionState } from '@/app/(site)/admin/users/actions'
import type { AdminAccount } from '@/server/moderation/accounts'
import { MODERATION_REASON_CODES } from '@/i18n/moderation-reasons'

function SuspensionForm({ account }: { account: AdminAccount }) {
  const t = useTranslations('Pages.admin.suspension')
  const reasons = useTranslations('Forms.own')
  const router = useRouter()
  const id = useId()
  const suspended = account.state !== 'suspended'
  const [state, action, pending] = useActionState<SuspensionActionState, FormData>(async (previous, form) => {
    const result = await setSuspensionAction(previous, form)
    if (result.status === 'saved') router.refresh()
    return result
  }, { status: 'idle' })
  const stale = state.status === 'conflict' || state.status === 'denied' || state.status === 'saved'
  return <form action={action} className="admin-decision-form">
    <input type="hidden" name="publicId" value={account.publicId} />
    <input type="hidden" name="expectedRoleVersion" value={account.roleVersion} />
    <input type="hidden" name="expectedSuspensionVersion" value={account.suspensionVersion} />
    <input type="hidden" name="suspended" value={String(suspended)} />
    <p>{t(suspended ? 'hideWarning' : 'restoreWarning')}</p>
    {suspended && <>
      <label htmlFor={`${id}-reason`}>{t('reason')}</label>
      <select id={`${id}-reason`} name="reasonCode" defaultValue="" required disabled={pending || stale}>
        <option value="" disabled>{t('chooseReason')}</option>
        {MODERATION_REASON_CODES.map(code => <option key={code} value={code}>{reasons(`reasons.${code}`)}</option>)}
      </select>
      <label htmlFor={`${id}-note`}>{t('note')}</label>
      <textarea id={`${id}-note`} name="note" maxLength={1000} rows={3} disabled={pending || stale} />
    </>}
    <label><input name="confirmed" type="checkbox" required disabled={pending || stale} /> {t(suspended ? 'confirmSuspend' : 'confirmReinstate', { name: account.displayName })}</label>
    <button type="submit" disabled={pending || stale}>{pending ? t('saving') : t(suspended ? 'suspend' : 'reinstate')}</button>
    {state.status !== 'idle' && <p role={state.status === 'saved' ? 'status' : 'alert'}>{t(state.status)}</p>}
    {state.status === 'conflict' && <button type="button" onClick={() => router.refresh()}>{t('reload')}</button>}
  </form>
}

export function SuspensionControl({ account }: { account: AdminAccount }) {
  return <SuspensionForm key={`${account.publicId}-${account.roleVersion}-${account.suspensionVersion}-${account.state}`} account={account} />
}
