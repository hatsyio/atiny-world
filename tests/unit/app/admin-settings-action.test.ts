import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/settings', () => ({ updateSettings: vi.fn() }))

import { updateSettingsAction } from '@/app/(site)/admin/settings/actions'
import { getSessionIdentity } from '@/server/auth/session'
import { updateSettings } from '@/server/moderation/settings'
import { revalidatePath } from 'next/cache'

function form(extra: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ premoderationEnabled: 'true', messageLimit: '25', cooldownSeconds: '0', expectedVersion: '1', expectedPendingActiveMessages: '3', confirmedImpact: 'true', ...extra })) data.set(key, value)
  return data
}

afterEach(() => vi.resetAllMocks())

describe('settings session action', () => {
  it('denies an anonymous direct request before querying the database', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue(null)
    expect(await updateSettingsAction({ status: 'idle' }, form())).toEqual({ status: 'denied' })
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('uses the session identity and revalidates every affected view', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'real-admin' })
    vi.mocked(updateSettings).mockResolvedValue({ ok: true, data: { premoderationEnabled: true, messageLimit: 25, cooldownSeconds: 0, version: 2, hiddenPendingMessages: 3, appearingPendingMessages: 0 } })
    expect(await updateSettingsAction({ status: 'idle' }, form({ clerkUserId: 'forged' }))).toEqual({ status: 'saved', hiddenPendingMessages: 3, appearingPendingMessages: 0 })
    expect(updateSettings).toHaveBeenCalledWith({}, {
      clerkUserId: 'real-admin', premoderationEnabled: true, messageLimit: 25, cooldownSeconds: 0, expectedVersion: 1, expectedPendingActiveMessages: 3, confirmedImpact: true,
    })
    for (const path of ['/', '/messages', '/my-messages', '/admin/settings']) expect(revalidatePath).toHaveBeenCalledWith(path)
  })

  it.each([
    ['premoderationEnabled', 'yes'], ['confirmedImpact', 'yes'], ['messageLimit', '0'], ['messageLimit', '1.5'], ['cooldownSeconds', '-1'], ['cooldownSeconds', '1.5'], ['expectedVersion', '0'], ['expectedPendingActiveMessages', '-1'],
  ])('rejects malformed %s values before querying the database', async (field, value) => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'admin' })
    expect(await updateSettingsAction({ status: 'idle' }, form({ [field]: value }))).toEqual({ status: 'invalid' })
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it.each([
    ['MESSAGE_VERSION_CONFLICT', 'conflict'], ['VALIDATION_ERROR', 'invalid'], ['NOT_FOUND', 'denied'],
  ] as const)('shows %s safely without revalidation', async (code, status) => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'admin' })
    vi.mocked(updateSettings).mockResolvedValue({ ok: false, error: { code, messageKey: 'admin.settings.conflict' } })
    expect(await updateSettingsAction({ status: 'idle' }, form())).toEqual({ status })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
