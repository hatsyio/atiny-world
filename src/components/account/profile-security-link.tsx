'use client'

import {useClerk} from '@clerk/nextjs'
import {useTranslations} from 'next-intl'

export function ProfileSecurityLink() {
  const {openUserProfile} = useClerk()
  const t = useTranslations('Pages.settings')
  return <button className="profile-submit" type="button" onClick={() => openUserProfile()}>{t('security')}</button>
}
