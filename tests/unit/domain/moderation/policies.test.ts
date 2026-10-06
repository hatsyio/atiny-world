import { describe, expect, it } from 'vitest'
import { availableModerationDecisions, canModerate, validateModerationDecision } from '@/domain/moderation/policies'

describe('message moderation policies', () => {
  it.each([
    ['pending', false, ['approve', 'reject']],
    ['pending', true, ['approve', 'reject', 'withdraw']],
    ['approved', true, ['withdraw']],
    ['approved', false, []],
    ['rejected', false, []],
    ['withdrawn', false, []],
  ] as const)('offers only allowed transitions from %s (public: %s)', (status, publicVisible, expected) => {
    expect(availableModerationDecisions(status, publicVisible)).toEqual(expected)
  })
  it.each(['admin', 'owner'])('allows an active %s', role => {
    expect(canModerate({ role, accountState: 'active', suspendedAt: null, displayName: 'ATINY' })).toBe(true)
  })
  it.each([
    { role: 'fan', accountState: 'active', suspendedAt: null, displayName: 'Fan' },
    { role: 'admin', accountState: 'active', suspendedAt: '2026-10-06', displayName: 'Admin' },
    { role: 'owner', accountState: 'deletion_pending', suspendedAt: null, displayName: 'Owner' },
    { role: 'admin', accountState: 'active', suspendedAt: null, displayName: '  ' },
  ])('denies unauthorized and unavailable actors', actor => expect(canModerate(actor)).toBe(false))
  it.each(['reject', 'withdraw'])('requires a known reason for %s', decision => {
    for (const reasonCode of [undefined, '', 'forged', 'toString', 42]) {
      expect(validateModerationDecision({ decision, reasonCode }).ok).toBe(false)
    }
    expect(validateModerationDecision({ decision, reasonCode: 'spam', note: '  Private note  ' })).toEqual({ ok: true, data: { decision, reasonCode: 'spam', note: 'Private note' } })
  })
  it('normalizes an approval and rejects malformed decisions and notes', () => {
    expect(validateModerationDecision({ decision: 'approve', note: '  ' })).toEqual({ ok: true, data: { decision: 'approve', reasonCode: null, note: null } })
    expect(validateModerationDecision({ decision: 'edit', note: '' }).ok).toBe(false)
    expect(validateModerationDecision({ decision: 'approve', note: 42 }).ok).toBe(false)
    expect(validateModerationDecision({ decision: 'reject', reasonCode: 'spam', note: 'a'.repeat(1001) }).ok).toBe(false)
    expect(validateModerationDecision({ decision: 'reject', reasonCode: 'privacy', note: 'a'.repeat(1000) }).ok).toBe(true)
  })
})
