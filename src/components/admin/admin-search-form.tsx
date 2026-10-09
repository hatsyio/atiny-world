'use client'

import { type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { AutoFilterForm } from '@/components/ui/auto-filter-form'

export function AdminSearchForm({ action, className, values, children }: { action: string; className: string; values: Record<string, string>; children: ReactNode }) {
  const t = useTranslations('Pages.admin')
  return <AutoFilterForm action={action} className={className} values={values} defaults={{ status: 'pending' }} resetValues={{ status: 'all' }} clearLabel={t('clearFilters')} loadingLabel={t('loading')}>
    {children}
  </AutoFilterForm>
}
