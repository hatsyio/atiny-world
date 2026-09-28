import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  userId: 'user_123' as string | null,
  username: null as string | null,
  updateUser: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: state.userId }),
  currentUser: async () => ({ id: 'user_123', username: state.username }),
  clerkClient: async () => ({ users: { updateUser: state.updateUser } }),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
}))

import { recoverUsername } from '../../../../src/server/actions/recover-username'

beforeEach(() => {
  state.userId = 'user_123'
  state.username = null
  state.updateUser.mockReset()
})

describe('recoverUsername', () => {
  it('saves a chosen username for the signed-in Clerk user and retries profile creation', async () => {
    const form = new FormData()
    form.set('username', 'atiny_fan')
    await expect(recoverUsername('en', form)).rejects.toThrow('redirect:/en/auth/continue')
    expect(state.updateUser).toHaveBeenCalledWith('user_123', { username: 'atiny_fan' })
  })

  it('does not update any user without a session', async () => {
    state.userId = null
    const form = new FormData()
    form.set('username', 'atiny_fan')
    await expect(recoverUsername('es', form)).rejects.toThrow('redirect:/es/sign-in')
    expect(state.updateUser).not.toHaveBeenCalled()
  })

  it('returns to the form when Clerk rejects the username', async () => {
    state.updateUser.mockRejectedValueOnce(new Error('username unavailable'))
    const form = new FormData()
    form.set('username', 'atiny_fan')
    await expect(recoverUsername('en', form)).rejects.toThrow('redirect:/en/profile?error=unavailable')
  })
})
