import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: vi.fn() }))
vi.mock('@/server/moderation/moderate-message', () => ({ moderateMessage: vi.fn() }))
import { moderateMessageAction } from '@/app/(site)/admin/messages/actions'
import { getSessionIdentity } from '@/server/auth/session'
import { moderateMessage } from '@/server/moderation/moderate-message'
import { revalidatePath } from 'next/cache'

const id = '123e4567-e89b-42d3-a456-426614174000'
function form(extra: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ publicId: id, expectedVersion: '1', decision: 'reject', reasonCode: 'spam', note: 'Private note', ...extra })) data.set(key, value)
  return data
}
afterEach(() => vi.resetAllMocks())
describe('moderation session action', () => {
  it('denies an anonymous direct action request before querying the database', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue(null)
    expect(await moderateMessageAction({ status: 'idle' }, form())).toEqual({ status: 'denied' })
    expect(moderateMessage).not.toHaveBeenCalled()
  })
  it('uses session identity, ignores forged actor/content, and invalidates public and private views', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'real_actor' })
    vi.mocked(moderateMessage).mockResolvedValue({ ok: true, data: { publicId: id, status: 'rejected', version: 2 } })
    expect(await moderateMessageAction({ status: 'idle' }, form({ clerkUserId: 'forged', content: 'Rewrite attempt' }))).toEqual({ status: 'saved' })
    expect(moderateMessage).toHaveBeenCalledWith({}, { clerkUserId: 'real_actor', publicId: id, expectedVersion: 1, decision: 'reject', reasonCode: 'spam', note: 'Private note' })
    for (const path of ['/', '/messages', '/my-messages', '/admin/messages', `/messages/${id}`]) expect(revalidatePath).toHaveBeenCalledWith(path)
  })
  it.each(['', '0', '-1', '1.5', '1e2', '9007199254740992'])('rejects malformed version %s', async expectedVersion => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
    expect(await moderateMessageAction({ status: 'idle' }, form({ expectedVersion }))).toEqual({ status: 'invalid' })
    expect(moderateMessage).not.toHaveBeenCalled()
  })
  it.each([
    ['MESSAGE_VERSION_CONFLICT', 'conflict'],
    ['INVALID_MODERATION_TRANSITION', 'transition'],
    ['VALIDATION_ERROR', 'invalid'],
    ['NOT_FOUND', 'denied'],
  ] as const)('surfaces %s without revalidation or automatic retry', async (code, status) => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
    vi.mocked(moderateMessage).mockResolvedValue({ ok: false, error: { code } })
    expect(await moderateMessageAction({ status: 'idle' }, form())).toEqual({ status })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('returns a safe error without exposing a database exception', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ clerkUserId: 'actor' })
    vi.mocked(moderateMessage).mockRejectedValue(new Error('private credentials'))
    expect(await moderateMessageAction({ status: 'idle' }, form())).toEqual({ status: 'error' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
