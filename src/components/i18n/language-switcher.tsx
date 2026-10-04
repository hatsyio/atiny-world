'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { isLanguagePreference } from '@/i18n/locale'
import { setLanguagePreference } from '@/server/actions/language-preference'
import { useLanguagePreference } from './language-context'

export function LanguageSwitcher() {
  const t = useTranslations('Settings')
  const preference = useLanguagePreference()
  const id = useId()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'saved' | 'error' | null>(null)
  return (
    <div className="language-switcher">
      <label htmlFor={id}>{t('language')}</label>
      <select id={id} value={preference} disabled={pending} onChange={(event) => {
        const value = event.target.value
        if (!isLanguagePreference(value)) return
        setStatus(null)
        startTransition(async () => {
          const result = await setLanguagePreference(value)
          setStatus(result.ok ? 'saved' : 'error')
          if (result.ok) router.refresh()
        })
      }}>
        <option value="auto">{t('auto')}</option>
        <option value="en">{t('en')}</option>
        <option value="es">{t('es')}</option>
      </select>
      <span role="status" aria-live="polite">{pending ? t('saving') : status ? t(status) : ''}</span>
    </div>
  )
}
