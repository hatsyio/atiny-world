import {authRoute} from '@/server/auth/auth-destination'
import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {redirect} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'

import {AccountProfile} from '@/components/account/account-profile'

export default async function SettingsPage() {
  const {userId} = await auth()
  if (!userId) redirect(authRoute(await getLocale(), 'sign-in', '/settings'))
  const t = await getTranslations('Pages.settings')
  const navigation = await getTranslations('Navigation')
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/#map">← {navigation('backMap')}</Link>
      <div className="account-settings">
        <h1>{t('title')}</h1>
        <AccountProfile />
      </div>
    </main>
  )
}
