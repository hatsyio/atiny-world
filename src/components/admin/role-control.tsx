'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { setAdministratorRoleAction, type RoleActionState } from '@/app/(site)/admin/users/actions'
import type { AdminAccount } from '@/server/moderation/accounts'

export function RoleControl({ account }: { account: AdminAccount }) {
  const t = useTranslations('Pages.admin')
  const [state, action, pending] = useActionState<RoleActionState, FormData>(setAdministratorRoleAction, { status: 'idle' })
  const nextRole = account.role === 'admin' ? 'fan' : 'admin'
  return <form action={action} className="admin-role-form">
    <input type="hidden" name="publicId" value={account.publicId} />
    <input type="hidden" name="expectedRole" value={account.role} />
    <input type="hidden" name="expectedRoleVersion" value={account.roleVersion} />
    <input type="hidden" name="role" value={nextRole} />
    <label><input key={nextRole} type="checkbox" required disabled={pending} /> {t('confirmRole', { name: account.displayName, role: t(`roles.${nextRole}`) })}</label>
    <button type="submit" disabled={pending}>{pending ? t('saving') : t(nextRole === 'admin' ? 'makeAdmin' : 'removeAdmin')}</button>
    {state.status !== 'idle' && <p role={state.status === 'saved' ? 'status' : 'alert'}>{t(state.status)}</p>}
  </form>
}
