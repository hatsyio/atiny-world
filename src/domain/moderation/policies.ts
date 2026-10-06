import type { MessageStatus } from '@/domain/contracts'
import { isModerationReasonCode, type ModerationReasonCode } from '@/i18n/moderation-reasons'

export const MODERATION_DECISIONS = ['approve', 'reject', 'withdraw'] as const
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number]

export function canModerate(actor: { role: string; accountState: string; suspendedAt: string | null; displayName: string }): boolean {
  return (actor.role === 'admin' || actor.role === 'owner') && actor.accountState === 'active' && actor.suspendedAt === null && !!actor.displayName.trim()
}

export function availableModerationDecisions(status: MessageStatus, publicVisible: boolean): ModerationDecision[] {
  const decisions: ModerationDecision[] = status === 'pending' ? ['approve', 'reject'] : []
  if (publicVisible && (status === 'pending' || status === 'approved')) decisions.push('withdraw')
  return decisions
}

export type ValidModerationDecision = { decision: ModerationDecision; reasonCode: ModerationReasonCode | null; note: string | null }

export function validateModerationDecision(input: { decision: unknown; reasonCode?: unknown; note?: unknown }): { ok: true; data: ValidModerationDecision } | { ok: false } {
  const { decision, reasonCode, note } = input
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'withdraw') return { ok: false }
  if (note !== undefined && (typeof note !== 'string' || note.length > 1000)) return { ok: false }
  if (reasonCode !== undefined && reasonCode !== '' && !isModerationReasonCode(reasonCode)) return { ok: false }
  if (decision !== 'approve' && !isModerationReasonCode(reasonCode)) return { ok: false }
  return { ok: true, data: {
    decision,
    reasonCode: decision === 'approve' ? null : reasonCode as ModerationReasonCode,
    note: typeof note === 'string' ? note.trim() || null : null,
  } }
}
