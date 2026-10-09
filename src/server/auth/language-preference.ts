import type { Sql } from '@/server/db/sql'
import { isLanguagePreference, type LanguagePreference } from '@/i18n/locale'
import { getSessionIdentity, type SessionIdentity } from '@/server/auth/session'

export async function readLanguagePreference(sql: Sql, clerkUserId: string): Promise<LanguagePreference | null> {
  const rows = await sql<{ language_preference: string | null }[]>`
    select language_preference from app_private.profiles where clerk_user_id = ${clerkUserId} limit 1
  `
  const value = rows[0]?.language_preference
  return isLanguagePreference(value) ? value : null
}

export async function saveLanguagePreferenceForSession(
  sql: Sql,
  preference: LanguagePreference,
  readIdentity: () => Promise<SessionIdentity | null> = getSessionIdentity,
): Promise<boolean> {
  if (!isLanguagePreference(preference)) return false
  const identity = await readIdentity()
  if (!identity) return false
  const rows = await sql<{ id: string }[]>`
    update app_private.profiles set language_preference = ${preference}, updated_at = now()
    where clerk_user_id = ${identity.clerkUserId} returning id
  `
  return rows.length === 1
}
