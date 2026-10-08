'use client'

import { useTranslations } from 'next-intl'
import { AdminSpinner } from './admin-spinner'

export function AdminLoading() {
  const t = useTranslations('Pages.admin')
  return <p role="status" className="admin-loading"><AdminSpinner />{t('loading')}</p>
}
