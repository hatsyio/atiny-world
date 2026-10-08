'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { isLanguagePreference } from '@/i18n/locale'
import { setLanguagePreference } from '@/server/actions/language-preference'
import { AppSelect } from '@/components/ui/app-select'
import { useLanguagePreference } from './language-context'

export function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'header' }) {
  const t = useTranslations('Settings')
  const preference = useLanguagePreference()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'saved' | 'error' | null>(null)
  return (
    <div className="language-switcher">
      <AppSelect label={t('language')} name="languagePreference" variant={variant} value={preference} disabled={pending} options={(['auto', 'en', 'es'] as const).map(value => ({ value, label: t(value) }))} onChange={value => {
        if (!isLanguagePreference(value)) return
        setStatus(null)
        startTransition(async () => {
          const result = await setLanguagePreference(value)
          setStatus(result.ok ? 'saved' : 'error')
          if (result.ok) router.refresh()
        })
      }} />
      <span role="status" aria-live="polite">{pending ? t('saving') : status ? t(status) : ''}</span>
    </div>
  )
}
