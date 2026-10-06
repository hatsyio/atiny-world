'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function AdminRefresh() {
  const router = useRouter()
  const t = useTranslations('Pages.admin.moderation')
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{t('reload')}</button>
}
