import type { Sql } from '@/server/db/sql'

// Session identity is supplied by the server; no target profile comes from the client.
// Return only the public reason code for this account, never the internal note.
export async function readOwnSuspensionReason(sql: Sql, clerkUserId: string): Promise<string | null> {
  const rows = await sql<{ suspension_reason_code: string | null }[]>`
    select suspension_reason_code from app_private.profiles
    where clerk_user_id = ${clerkUserId} and suspended_at is not null and account_state = 'active'
  `
  return rows[0]?.suspension_reason_code ?? null
}
