import {authRoute} from '@/server/auth/auth-destination'
import {getLocale, getTranslations} from 'next-intl/server'
import Link from 'next/link'
import {redirect} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'

import {LanguageSwitcher} from '@/components/i18n/language-switcher'
import {ProfileSecurityLink} from '@/components/account/profile-security-link'

export default async function SettingsPage() {
  const {userId} = await auth()
  if (!userId) redirect(authRoute(await getLocale(), 'sign-in', '/settings'))
  const t = await getTranslations('Pages.settings')
  const navigation = await getTranslations('Navigation')
  return <main className="auth-page"><Link className="auth-back" href="/#map">← {navigation('backMap')}</Link><div className="auth-panel"><h1>{t('title')}</h1><p>{t('intro')}</p><LanguageSwitcher /><ProfileSecurityLink /></div></main>
}
