import { describe, expect, it } from 'vitest'

import { isMessagePublic } from '../../../../src/domain/messages/visibility'
import type { MessageStatus } from '../../../../src/domain/contracts'

describe('canonical visibility predicate', () => {
  const approved = true
  const pendingWithoutPremoderation = true
  const pendingWithPremoderation = false

  it.each<{
    status: MessageStatus
    premoderationEnabled: boolean
    accountActive: boolean
    suspended: boolean
    expected: boolean
  }>([
    {
      status: 'approved',
      premoderationEnabled: true,
      accountActive: true,
      suspended: false,
      expected: true,
    },
    {
      status: 'pending',
      premoderationEnabled: true,
      accountActive: true,
      suspended: false,
      expected: false,
    },
    {
      status: 'pending',
      premoderationEnabled: false,
      accountActive: true,
      suspended: false,
      expected: true,
    },
    {
      status: 'rejected',
      premoderationEnabled: false,
      accountActive: true,
      suspended: false,
      expected: false,
    },
    {
      status: 'withdrawn',
      premoderationEnabled: false,
      accountActive: true,
      suspended: false,
      expected: false,
    },
    {
      status: 'approved',
      premoderationEnabled: false,
      accountActive: true,
      suspended: true,
      expected: false,
    },
    {
      status: 'pending',
      premoderationEnabled: false,
      accountActive: true,
      suspended: true,
      expected: false,
    },
    {
      status: 'approved',
      premoderationEnabled: false,
      accountActive: false,
      suspended: false,
      expected: false,
    },
  ])(
    '($status, premod?$premoderationEnabled, active:$accountActive, suspended:$suspended) → $expected',
    ({ status, premoderationEnabled, accountActive, suspended, expected }) => {
      expect(
        isMessagePublic({
          messageStatus: status,
          premoderationEnabled,
          accountState: accountActive ? 'active' : 'deletion_pending',
          suspendedAt: suspended ? '2026-09-15T00:00:00Z' : null,
        }),
      ).toBe(expected)
    },
  )

  it('never discloses a deletion-pending account even when approved', () => {
    expect(
      isMessagePublic({
        messageStatus: 'approved',
        premoderationEnabled: true,
        accountState: 'deletion_pending',
        suspendedAt: null,
      }),
    ).toBe(false)
  })

  it('is exposed with the approved and pending flags for readability', () => {
    expect(approved).toBe(true)
    expect(pendingWithoutPremoderation).toBe(true)
    expect(pendingWithPremoderation).toBe(false)
  })
})