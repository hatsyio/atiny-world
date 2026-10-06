import { expect, it } from 'vitest'
import { canSetSuspension, validateSuspension } from '@/domain/moderation/policies'

it.each([
  ['admin', 'fan', true], ['admin', 'admin', false], ['admin', 'owner', false],
  ['owner', 'fan', true], ['owner', 'admin', true], ['owner', 'owner', false], ['fan', 'fan', false],
])('suspension permissions for %s on %s = %s', (role, targetRole, expected) => {
  expect(canSetSuspension({ role, accountState: 'active', suspendedAt: null, displayName: 'Actor' }, { role: targetRole, accountState: 'active', displayName: 'Target' })).toBe(expected)
})
it('rejects inactive, suspended or incomplete actors and unavailable targets', () => {
  const actor = { role: 'owner', accountState: 'active', suspendedAt: null, displayName: 'Owner' }
  const target = { role: 'fan', accountState: 'active', displayName: 'Fan' }
  for (const patch of [{ suspendedAt: 'today' }, { accountState: 'deletion_pending' }, { displayName: ' ' }]) expect(canSetSuspension({ ...actor, ...patch }, target)).toBe(false)
  for (const patch of [{ accountState: 'deletion_pending' }, { displayName: ' ' }, { role: 'unknown' }]) expect(canSetSuspension(actor, { ...target, ...patch })).toBe(false)
})
it('requires a known reason to suspend and validates notes without coercing the decision', () => {
  expect(validateSuspension({ suspended: true, reasonCode: 'privacy', note: '  Note  ' })).toEqual({ ok: true, data: { suspended: true, reasonCode: 'privacy', note: 'Note' } })
  expect(validateSuspension({ suspended: false })).toEqual({ ok: true, data: { suspended: false, reasonCode: null, note: null } })
  for (const input of [{ suspended: true }, { suspended: true, reasonCode: 'unknown' }, { suspended: 'false' }, { suspended: true, reasonCode: 'spam', note: 'x'.repeat(1001) }]) expect(validateSuspension(input).ok).toBe(false)
})
