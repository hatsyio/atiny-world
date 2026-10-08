'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import posthog from 'posthog-js'

export function AnalyticsIdentity() {
  const { userId, isLoaded } = useAuth()
  const identifiedUserId = useRef<string | null>(null)

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

  return null
}
