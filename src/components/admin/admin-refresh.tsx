'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AdminSpinner } from './admin-spinner'

export function AdminRefresh() {
  const router = useRouter()
  const t = useTranslations('Pages.admin.moderation')
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending && <AdminSpinner />}{t('reload')}</button>
}
