import {authRoute} from '@/server/auth/auth-destination'
import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {redirect} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'

import {AccountProfile} from '@/components/account/account-profile'
import { authorizeSession } from '@/server/auth/authorize'
import { getDb } from '@/server/db/client'

export default async function SettingsPage() {
  const {userId} = await auth()
  if (!userId) redirect(authRoute(await getLocale(), 'sign-in', '/settings'))
  const t = await getTranslations('Pages.settings')
  const navigation = await getTranslations('Navigation')
  const profile = await authorizeSession(getDb())
  const admin = await getTranslations('Pages.admin')
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/#map">← {navigation('backMap')}</Link>
      <div className="account-settings">
        <h1>{t('title')}</h1>
        {profile.ok && (profile.data.role === 'admin' || profile.data.role === 'owner') ? <Link className="profile-cancel" href="/admin">{admin('title')}</Link> : null}
        <AccountProfile />
      </div>
    </main>
  )
}
