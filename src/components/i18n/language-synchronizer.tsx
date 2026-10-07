'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { synchronizeLanguagePreference } from '@/server/actions/language-preference'
import { useLanguagePreference } from './language-context'

export function LanguageSynchronizer() {
  const { userId, isLoaded } = useAuth()
  const identifiedUserId = useRef<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const preference = useLanguagePreference()
  useEffect(() => {
    if (!isLoaded) return
    if (!userId) {
      if (identifiedUserId.current) posthog.reset()
      identifiedUserId.current = null
      return
    }
    if (identifiedUserId.current === userId) return

    if (identifiedUserId.current) posthog.reset()

    posthog.identify(userId)
    identifiedUserId.current = userId
  }, [isLoaded, userId])

  useEffect(() => {
    if (!isLoaded) return
    let active = true
    void synchronizeLanguagePreference().then((result) => {
      if (active && result.ok && result.locale && (result.locale !== locale || result.preference !== preference)) router.refresh()
    })
    return () => { active = false }
  }, [isLoaded, userId, preference, locale, pathname, router])
  return null
}
