import type { Sql, TransactionSql } from '@/server/db/sql'
import { errorResult, okResult, type ActionResult } from '@/domain/contracts'
import { canModerate } from '@/domain/moderation/policies'

type AdminActor = {
  id: string
  role: string
  account_state: string
  suspended_at: string | null
  display_name: string
}

type SettingsRow = {
  premoderation_enabled: boolean
  message_limit: number
  cooldown_seconds: number
  version: number
}

export type AdminSettings = {
  premoderationEnabled: boolean
  messageLimit: number
  cooldownSeconds: number
  version: number
  pendingActiveMessages: number
}

export type UpdateSettingsInput = {
  clerkUserId: string
  premoderationEnabled: boolean
  messageLimit: number
  cooldownSeconds: number
  expectedVersion: number
  expectedPendingActiveMessages: number
  confirmedImpact: boolean
}

export type UpdateSettingsSuccess = Omit<AdminSettings, 'pendingActiveMessages'> & {
  hiddenPendingMessages: number
  appearingPendingMessages: number
}

const denied = () => errorResult('NOT_FOUND', { messageKey: 'admin.settings.denied' })

function valid(input: UpdateSettingsInput): boolean {
  return typeof input.premoderationEnabled === 'boolean'
    && Number.isSafeInteger(input.messageLimit) && input.messageLimit > 0
    && Number.isSafeInteger(input.cooldownSeconds) && input.cooldownSeconds >= 0
    && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0 && input.expectedVersion < 2147483647
    && Number.isSafeInteger(input.expectedPendingActiveMessages) && input.expectedPendingActiveMessages >= 0
    && typeof input.confirmedImpact === 'boolean'
}

async function authorize(tx: TransactionSql, clerkUserId: string): Promise<AdminActor | null> {
  const actors = await tx<AdminActor[]>`
    select id, role, account_state, suspended_at, display_name
      from app_private.profiles
     where clerk_user_id = ${clerkUserId}
     for share
  `
  const actor = actors[0]
  return actor && canModerate({ role: actor.role, accountState: actor.account_state, suspendedAt: actor.suspended_at, displayName: actor.display_name }) ? actor : null
}

async function pendingActiveMessages(tx: TransactionSql): Promise<number> {
  const rows = await tx<{ count: number }[]>`
    select count(*)::int as count
      from app_private.messages m
      join app_private.profiles p on p.id = m.author_id
     where m.status = 'pending'
       and p.account_state = 'active'
       and p.suspended_at is null
  `
  return rows[0]?.count ?? 0
}

export async function getAdminSettings(sql: Sql, clerkUserId: string): Promise<ActionResult<AdminSettings>> {
  return sql.begin(async tx => {
    const actor = await authorize(tx, clerkUserId)
    if (!actor) return denied()
    const settings = (await tx<SettingsRow[]>`
      select premoderation_enabled, message_limit, cooldown_seconds, version
        from app_private.settings where id = 1 for share
    `)[0]
    if (!settings) throw new Error('Missing application settings')
    return okResult({
      premoderationEnabled: settings.premoderation_enabled,
      messageLimit: settings.message_limit,
      cooldownSeconds: settings.cooldown_seconds,
      version: settings.version,
      pendingActiveMessages: await pendingActiveMessages(tx),
    })
  })
}

export async function updateSettings(sql: Sql, input: UpdateSettingsInput): Promise<ActionResult<UpdateSettingsSuccess>> {
  if (!valid(input)) return errorResult('VALIDATION_ERROR', { messageKey: 'admin.settings.invalid' })
  return sql.begin(async tx => {
    const actor = await authorize(tx, input.clerkUserId)
    if (!actor) return denied()
    const settings = (await tx<SettingsRow[]>`
      select premoderation_enabled, message_limit, cooldown_seconds, version
        from app_private.settings where id = 1 for update
    `)[0]
    if (!settings) throw new Error('Missing application settings')
    if (settings.version !== input.expectedVersion) return errorResult('MESSAGE_VERSION_CONFLICT', { messageKey: 'admin.settings.conflict' })
    const pending = await pendingActiveMessages(tx)
    if (settings.premoderation_enabled !== input.premoderationEnabled && !input.confirmedImpact) {
      return errorResult('VALIDATION_ERROR', { messageKey: 'admin.settings.confirmationRequired' })
    }
    if (settings.premoderation_enabled !== input.premoderationEnabled && pending !== input.expectedPendingActiveMessages) {
      return errorResult('MESSAGE_VERSION_CONFLICT', { messageKey: 'admin.settings.conflict' })
    }
    const hiddenPendingMessages = !settings.premoderation_enabled && input.premoderationEnabled ? pending : 0
    const appearingPendingMessages = settings.premoderation_enabled && !input.premoderationEnabled ? pending : 0
    const version = settings.version + 1
    await tx`
      update app_private.settings
         set premoderation_enabled = ${input.premoderationEnabled},
             message_limit = ${input.messageLimit},
             cooldown_seconds = ${input.cooldownSeconds},
             version = ${version},
             updated_by = ${actor.id},
             updated_at = now()
       where id = 1
    `
    await tx`
      insert into app_private.admin_audit (actor_id, action, target_type, metadata)
      values (${actor.id}, 'update_settings', 'settings', ${tx.json({
        previousPremoderationEnabled: settings.premoderation_enabled,
        premoderationEnabled: input.premoderationEnabled,
        previousMessageLimit: settings.message_limit,
        messageLimit: input.messageLimit,
        previousCooldownSeconds: settings.cooldown_seconds,
        cooldownSeconds: input.cooldownSeconds,
        previousVersion: settings.version,
        version,
        hiddenPendingMessages,
        appearingPendingMessages,
      })})
    `
    return okResult({
      premoderationEnabled: input.premoderationEnabled,
      messageLimit: input.messageLimit,
      cooldownSeconds: input.cooldownSeconds,
      version,
      hiddenPendingMessages,
      appearingPendingMessages,
    })
  })
}
