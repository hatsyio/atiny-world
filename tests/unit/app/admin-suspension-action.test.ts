import { expect, it, vi, afterEach } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/accounts', () => ({ setSuspension: vi.fn() }))
import { setSuspensionAction } from '@/app/(site)/admin/users/actions'
import { getSessionIdentity } from '@/server/auth/session'
import { setSuspension } from '@/server/moderation/accounts'
import { revalidatePath } from 'next/cache'
afterEach(() => vi.resetAllMocks())
function form(patch = {}) {
  const result = new FormData()
  for (const [key, value] of Object.entries({ publicId: 'target', suspended: 'true', expectedRoleVersion: '1', expectedSuspensionVersion: '1', reasonCode: 'spam', note: 'Note', confirmed: 'on', ...patch })) result.set(key, String(value))
  return result
}
it('denies unauthenticated direct calls', async () => {
  vi.mocked(getSessionIdentity).mockResolvedValue(null)
  expect(await setSuspensionAction({ status: 'idle' }, form())).toEqual({ status: 'denied' })
})
it.each([{ confirmed: '' }, { suspended: 'yes' }, { expectedSuspensionVersion: '1.5' }, { expectedRoleVersion: '0' }])('requires confirmation and strict decision/version input %s', async patch => {
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  expect(await setSuspensionAction({ status: 'idle' }, form(patch))).toEqual({ status: 'invalid' })
  expect(setSuspension).not.toHaveBeenCalled()
})
it('uses the session identity and revalidates all affected views', async () => {
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(setSuspension).mockResolvedValue({ ok: true, data: { publicId: 'target', suspended: true, suspensionVersion: 2 } })
  expect(await setSuspensionAction({ status: 'idle' }, form({ clerkUserId: 'forged' }))).toEqual({ status: 'saved' })
  expect(setSuspension).toHaveBeenCalledWith({}, { clerkUserId: 'actor', publicId: 'target', suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode: 'spam', note: 'Note' })
  expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
})
it('returns stale form conflicts without revalidation or retry', async () => {
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
  vi.mocked(setSuspension).mockResolvedValue({ ok: false, error: { code: 'MESSAGE_VERSION_CONFLICT', messageKey: 'admin.suspension.conflict' } })
  expect(await setSuspensionAction({ status: 'idle' }, form())).toEqual({ status: 'conflict' })
  expect(revalidatePath).not.toHaveBeenCalled()
})
