'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { useAuth } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { synchronizeLanguagePreference } from '@/server/actions/language-preference'
import { useLanguagePreference } from './language-context'

export function LanguageSynchronizer() {
  const { userId, isLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const preference = useLanguagePreference()
  // Navigation retries incomplete signups and observes preferences saved in other tabs.
  useEffect(() => {
    if (!isLoaded) return
    let active = true
    void synchronizeLanguagePreference().then((result) => {
      if (active && result.ok && result.locale && (result.locale !== locale || result.preference !== preference)) router.refresh()
    }).catch((error: unknown) => {
      // Keep the current language and draft; the next navigation retries.
      posthog.captureException(error, { operation: 'synchronize_language_preference' })
    })
    return () => { active = false }
  }, [isLoaded, userId, preference, locale, pathname, router])
  return null
}
