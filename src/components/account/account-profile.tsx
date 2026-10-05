'use client'

import {UserProfile} from '@clerk/nextjs'
import {useTranslations} from 'next-intl'
import {LanguageSwitcher} from '@/components/i18n/language-switcher'

function PreferencesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" /></svg>
}

export function AccountProfile() {
  const t = useTranslations('Settings')
  return (
    <UserProfile routing="hash" appearance={{
      variables: {fontFamily: 'var(--font-interface), sans-serif'},
      elements: {rootBox: {width: '100%'}, cardBox: {width: '100%', maxWidth: '100%'}},
    }}>
      <UserProfile.Page label="account" />
      <UserProfile.Page label="security" />
      <UserProfile.Page label={t('preferences')} url="preferences" labelIcon={<PreferencesIcon />}>
        <section className="account-preferences">
          <h2>{t('preferences')}</h2>
          <p>{t('description')}</p>
          <LanguageSwitcher />
        </section>
      </UserProfile.Page>
    </UserProfile>
  )
}
