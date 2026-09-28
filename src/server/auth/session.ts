import type { Sql } from 'postgres'

import { auth } from '@clerk/nextjs/server'

export type SessionIdentity = {
  clerkUserId: string
}

export type ClerkAuthReader = () => Promise<{ userId: string | null }>

export async function getSessionIdentity(
  readAuth: ClerkAuthReader = auth,
): Promise<SessionIdentity | null> {
  const { userId } = await readAuth()

  return userId ? { clerkUserId: userId } : null
}

export type SessionProfileRow = {
  id: string
  public_id: string
  display_name: string
  role: string
  account_state: string
  suspended_at: string | null
}

export type ProfileReader = (sql: Sql, clerkUserId: string) => Promise<SessionProfileRow | null>

export const readProfileByClerkUserId: ProfileReader = async (sql, clerkUserId) => {
  const rows = await sql<SessionProfileRow[]>`
    select id, public_id, display_name, role, account_state, suspended_at
      from app_private.profiles
     where clerk_user_id = ${clerkUserId}
     limit 1
  `

  return rows[0] ?? null
}
