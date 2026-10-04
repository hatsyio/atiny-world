import {getLocale, getTranslations} from 'next-intl/server'
import { authRoute, authDestination, type AuthSearchParams } from '@/server/auth/auth-destination'
import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { recoverUsername } from '@/server/actions/recover-username'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'



export default async function ProfilePage({
  searchParams,
}: { params?: Promise<{lang?: string}>; searchParams: Promise<AuthSearchParams & { error?: string }> }) {
  const locale = await getLocale()
  const t = await getTranslations('Pages.profile')
  const { next, error } = await searchParams
  const destination = authDestination(locale, next)
  const gate = await resolveAccountGate(getDb())

  if (gate.kind === 'anonymous') redirect(authRoute(locale, 'sign-in', destination))
  if (gate.kind === 'allowed') redirect(destination)

  const back = <Link className="auth-back" href={'/#map'}>← {t('back')}</Link>

  if (gate.kind === 'suspended' || gate.kind === 'deletion-pending') {
    return (
      <main className="auth-page">
        {back}
        <div className="auth-panel">
          <p className="auth-script">{t('script')}</p>
          <h1>{t('title')}</h1>
          <p className="profile-intro">{t('unavailable')}</p>
        </div>
      </main>
    )
  }

  const user = await currentUser()
  const legacyName = user?.unsafeMetadata?.publicName
  if (user && !user.username && !(typeof legacyName === 'string' && legacyName.trim())) {
    return (
      <main className="auth-page">
        {back}
        <div className="auth-panel">
          <p className="auth-script">{t('script')}</p>
          <h1>{t('usernameTitle')}</h1>
          <p className="profile-intro">{t('usernameIntro')}</p>
          <form className="profile-form" action={recoverUsername.bind(null, locale)}>
            <input type="hidden" name="next" value={destination} />
            <div className="profile-field">
              <label htmlFor="recovery-username">{t('usernameLabel')}</label>
              <input id="recovery-username" name="username" type="text" autoComplete="username" minLength={4} maxLength={64} required />
              {error && <p className="profile-error" role="alert">{error === 'invalid' ? t('usernameInvalid') : t('usernameUnavailable')}</p>}
            </div>
            <button className="profile-submit" type="submit">{t('usernameSubmit')}</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      {back}
      <div className="auth-panel">
        <p className="auth-script">{t('script')}</p>
        <h1>{t('title')}</h1>
        <p className="profile-intro">{t('intro')}</p>
        <Link className="profile-submit" href={authRoute(locale, 'auth/continue', destination)}>{t('retry')}</Link>
      </div>
    </main>
  )
}
