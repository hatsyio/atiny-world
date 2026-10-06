'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { updateSettingsAction, type SettingsActionState } from '@/app/(site)/admin/settings/actions'
import type { AdminSettings } from '@/server/moderation/settings'

export function AdminSettingsControl({ settings }: { settings: AdminSettings }) {
  const t = useTranslations('Pages.admin.settingsPanel')
  const [premoderationEnabled, setPremoderationEnabled] = useState(settings.premoderationEnabled)
  const [confirmed, setConfirmed] = useState(false)
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(updateSettingsAction, { status: 'idle' })
  const moderationChanged = premoderationEnabled !== settings.premoderationEnabled
  const hidden = moderationChanged && premoderationEnabled ? settings.pendingActiveMessages : 0
  const appearing = moderationChanged && !premoderationEnabled ? settings.pendingActiveMessages : 0

  const statusMessage = state.status === 'saved'
    ? t('saved')
    : state.status === 'denied'
      ? t('denied')
      : state.status === 'invalid'
        ? t('invalid')
        : state.status === 'conflict'
          ? t('conflict')
          : state.status === 'error'
            ? t('error')
            : null

  return <form action={action} className="admin-settings-form">
    <input type="hidden" name="premoderationEnabled" value={String(premoderationEnabled)} />
    <input type="hidden" name="expectedVersion" value={settings.version} />
    <input type="hidden" name="expectedPendingActiveMessages" value={settings.pendingActiveMessages} />
    <input type="hidden" name="confirmedImpact" value={String(!moderationChanged || confirmed)} />
    <label className="admin-settings-check">
      <input type="checkbox" checked={premoderationEnabled} onChange={event => { setPremoderationEnabled(event.target.checked); setConfirmed(false) }} />
      {t('premoderation')}
    </label>
    <label>
      {t('messageLimit')}
      <input name="messageLimit" type="number" min="1" step="1" defaultValue={settings.messageLimit} required />
    </label>
    <label>
      {t('cooldown')}
      <input name="cooldownSeconds" type="number" min="0" step="1" defaultValue={settings.cooldownSeconds} required />
    </label>
    {moderationChanged ? <div className="admin-settings-impact">
      <p>{premoderationEnabled ? t('hideImpact', { count: hidden }) : t('showImpact', { count: appearing })}</p>
      <label>
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />
        {premoderationEnabled ? t('confirmHide', { count: hidden }) : t('confirmShow', { count: appearing })}
      </label>
    </div> : null}
    {statusMessage ? <p role="alert">{statusMessage}</p> : null}
    <button type="submit" disabled={pending || (moderationChanged && !confirmed)}>{pending ? t('saving') : t('save')}</button>
  </form>
}
