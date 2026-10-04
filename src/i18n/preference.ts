import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { getSessionIdentity } from '@/server/auth/session'
import { readLanguagePreference } from '@/server/auth/language-preference'
import { getDb } from '@/server/db'
import { ACCOUNT_LANGUAGE_COOKIE, VISITOR_LANGUAGE_COOKIE, resolveLanguage } from './locale'

export const getRequestLanguage = cache(async () => {
  const [identity, cookieStore, headerStore] = await Promise.all([getSessionIdentity(), cookies(), headers()])
  const profilePreference = identity ? await readLanguagePreference(getDb(), identity.clerkUserId) : null
  return resolveLanguage({
    userId: identity?.clerkUserId ?? null,
    profilePreference,
    visitorCookie: cookieStore.get(VISITOR_LANGUAGE_COOKIE)?.value,
    accountCookie: cookieStore.get(ACCOUNT_LANGUAGE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  })
})
