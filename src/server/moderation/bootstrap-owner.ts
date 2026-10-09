import type { Sql } from '@/server/db/sql'

/** Administrative CLI only. Never expose initial owner assignment as a web action. */
export async function bootstrapOwner(sql: Sql, input: { clerkUserId: string; displayName: string; verifiedOtherInstanceUserId?: string }) {
  const name = input.displayName.trim()
  if (!input.clerkUserId.startsWith('user_') || !name || Array.from(name).length > 64) throw new Error('Invalid owner identity')
  return sql.begin(async tx => {
    // Initial provisioning is rare; serialize it with other profile writes.
    await tx`lock table app_private.profiles in share row exclusive mode`
    const owners = await tx`select clerk_user_id from app_private.profiles where role = 'owner'`
    if (owners.some(row => row.clerk_user_id !== input.clerkUserId && row.clerk_user_id !== input.verifiedOtherInstanceUserId)) throw new Error('An owner already exists; refusing to replace or add one')
    const rows = await tx<{ id: string; public_id: string; role: string; account_state: string; suspended_at: string | null; display_name: string }[]>`
      insert into app_private.profiles (clerk_user_id, display_name)
      values (${input.clerkUserId}, ${name})
      on conflict (clerk_user_id) do update set updated_at = app_private.profiles.updated_at
      returning id, public_id, role, account_state, suspended_at, display_name
    `
    const target = rows[0]
    if (target.account_state !== 'active' || target.suspended_at || !target.display_name.trim()) throw new Error('Owner account is unavailable')
    if (target.role !== 'owner') {
      await tx`update app_private.profiles set role = 'owner', updated_at = now() where id = ${target.id}`
      await tx`insert into app_private.admin_audit (actor_id, action, target_type, target_public_id, metadata)
        values (${target.id}, 'bootstrap_owner', 'profile', ${target.public_id}, ${tx.json({ previousRole: target.role, role: 'owner' })})`
    }
    return { publicId: target.public_id, role: 'owner' as const }
  })
}
