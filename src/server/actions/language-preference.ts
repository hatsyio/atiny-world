'use server'

import { cookies, headers } from 'next/headers'
import { ACCOUNT_LANGUAGE_COOKIE, VISITOR_LANGUAGE_COOKIE, encodeAccountPreference, isLanguagePreference, resolveLanguage, type LanguagePreference } from '@/i18n/locale'
import { getSessionIdentity } from '@/server/auth/session'
import { readLanguagePreference, saveLanguagePreferenceForSession } from '@/server/auth/language-preference'
import { getDb } from '@/server/db'
import { completeProfileForSession } from '@/server/actions/complete-profile'

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 }

export async function setLanguagePreference(value: LanguagePreference): Promise<{ ok: boolean }> {
  if (!isLanguagePreference(value)) return { ok: false }
  try {
    const identity = await getSessionIdentity()
    const store = await cookies()
    if (identity) {
      const db = getDb()
      let saved = await saveLanguagePreferenceForSession(db, value, async () => identity)
      if (!saved) {
        const completed = await completeProfileForSession(db, async () => identity)
        if (!completed.ok) return { ok: false }
        saved = await saveLanguagePreferenceForSession(db, value, async () => identity)
      }
      if (!saved) return { ok: false }
      // Keep the visitor preference separate; account settings must not leak after logout.
      store.set(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference(identity.clerkUserId, value), cookieOptions)
    } else {
      store.delete(ACCOUNT_LANGUAGE_COOKIE)
      if (value === 'auto') store.delete(VISITOR_LANGUAGE_COOKIE)
      else store.set(VISITOR_LANGUAGE_COOKIE, value, cookieOptions)
    }
    return { ok: true }
  } catch { return { ok: false } }
}

export async function synchronizeLanguagePreference(): Promise<{ ok: boolean; locale?: string; preference?: LanguagePreference }> {
  try {
    const identity = await getSessionIdentity()
    const [store, requestHeaders] = await Promise.all([cookies(), headers()])
    if (!identity) {
      store.delete(ACCOUNT_LANGUAGE_COOKIE)
      return { ok: true, ...resolveLanguage({ userId: null, visitorCookie: store.get(VISITOR_LANGUAGE_COOKIE)?.value, acceptLanguage: requestHeaders.get('accept-language') }) }
    }
    const db = getDb()
    const profilePreference = await readLanguagePreference(db, identity.clerkUserId)
    const language = resolveLanguage({ userId: identity.clerkUserId, profilePreference, accountCookie: store.get(ACCOUNT_LANGUAGE_COOKIE)?.value, visitorCookie: store.get(VISITOR_LANGUAGE_COOKIE)?.value, acceptLanguage: requestHeaders.get('accept-language') })
    if (profilePreference === null) {
      // A username-ready Clerk account may arrive before the product profile.
      // Incomplete signups retain their owner-bound cookie until navigation retries.
      await completeProfileForSession(db, async () => identity)
      // Conditional adoption cannot overwrite an explicit setting changed in another tab.
      await db`update app_private.profiles set language_preference = ${language.preference}, updated_at = now()
        where clerk_user_id = ${identity.clerkUserId} and language_preference is null`
    }
    const preference = await readLanguagePreference(db, identity.clerkUserId) ?? language.preference
    store.set(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference(identity.clerkUserId, preference), cookieOptions)
    return { ok: true, ...resolveLanguage({ userId: identity.clerkUserId, profilePreference: preference, acceptLanguage: requestHeaders.get('accept-language') }) }
  } catch { return { ok: false } }
}
