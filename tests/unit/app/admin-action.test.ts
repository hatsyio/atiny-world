import { expect, it, vi, afterEach } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/accounts', () => ({ setAdministratorRole: vi.fn() }))
import { setAdministratorRoleAction } from '@/app/(site)/admin/users/actions'
import { getSessionIdentity } from '@/server/auth/session'
import { setAdministratorRole } from '@/server/moderation/accounts'
afterEach(() => vi.resetAllMocks())
it('rejects an unauthenticated direct action request', async () => {
  vi.mocked(getSessionIdentity).mockResolvedValue(null)
  expect(await setAdministratorRoleAction({ status: 'idle' }, new FormData())).toEqual({ status: 'denied' })
  expect(setAdministratorRole).not.toHaveBeenCalled()
})
it('uses the session actor and ignores a forged actor in the form', async () => {
  vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'real_actor' })
  vi.mocked(setAdministratorRole).mockResolvedValue({ ok: true, data: { publicId: 'target', role: 'admin' } })
  const form = new FormData()
  for (const [key, value] of Object.entries({ publicId: 'target', role: 'admin', expectedRole: 'fan', expectedRoleVersion: '1', clerkUserId: 'forged' })) form.set(key, value)
  expect(await setAdministratorRoleAction({ status: 'idle' }, form)).toEqual({ status: 'saved' })
  expect(setAdministratorRole).toHaveBeenCalledWith({}, { clerkUserId: 'real_actor', publicId: 'target', role: 'admin', expectedRole: 'fan', expectedRoleVersion: 1 })
})
