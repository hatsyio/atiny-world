import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  identity: vi.fn(), read: vi.fn(), save: vi.fn(), complete: vi.fn(),
  set: vi.fn(), remove: vi.fn(), get: vi.fn(), sql: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set, delete: mocks.remove }), headers: async () => ({ get: () => 'en' }) }))
vi.mock('@/server/auth/session', () => ({ getSessionIdentity: mocks.identity }))
vi.mock('@/server/auth/language-preference', () => ({ readLanguagePreference: mocks.read, saveLanguagePreferenceForSession: mocks.save }))
vi.mock('@/server/auth/profile-recovery', () => ({ recoverProfile: mocks.complete }))
vi.mock('@/server/db', () => ({ getDb: () => mocks.sql }))

import { setLanguagePreference, synchronizeLanguagePreference } from '../../../src/server/actions/language-preference'
import { ACCOUNT_LANGUAGE_COOKIE, VISITOR_LANGUAGE_COOKIE, encodeAccountPreference } from '../../../src/i18n/locale'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.identity.mockResolvedValue(null)
  mocks.read.mockResolvedValue(null)
  mocks.save.mockResolvedValue(true)
  mocks.complete.mockResolvedValue({ kind: 'available', profile: { language_preference: null } })
  mocks.sql.mockResolvedValue([])
})

describe('language action cookie ownership', () => {
  it.each(['es', 'en', 'auto'] as const)('uses the recovered %s preference without another database read', async (preference) => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'a' })
    mocks.complete.mockResolvedValue({ kind: 'available', profile: { language_preference: preference } })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: preference === 'auto' ? 'en' : preference, preference })
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.sql).not.toHaveBeenCalled()
    expect(mocks.set).toHaveBeenCalledWith(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference('a', preference), expect.any(Object))
  })
  it('auto for a visitor clears their stale manual choice', async () => {
    expect(await setLanguagePreference('auto')).toEqual({ ok: true })
    expect(mocks.remove).toHaveBeenCalledWith(VISITOR_LANGUAGE_COOKIE)
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('authenticated auto persists and leaves the visitor cookie untouched', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'a' })
    expect(await setLanguagePreference('auto')).toEqual({ ok: true })
    expect(mocks.save).toHaveBeenCalledWith(mocks.sql, 'auto', expect.any(Function))
    expect(mocks.set).toHaveBeenCalledWith(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference('a', 'auto'), expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }))
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('does not report success when a missing profile cannot be completed', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'a' })
    mocks.save.mockResolvedValue(false)
    mocks.complete.mockResolvedValue({ kind: 'incomplete' })
    expect(await setLanguagePreference('es')).toEqual({ ok: false })
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('reports technical recovery failures without persisting a cookie', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'a' })
    mocks.complete.mockResolvedValue({ kind: 'failed', error: { code: 'INTERNAL_ERROR', messageKey: 'profile.creationFailed' } })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: false })
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('adopts the anonymous manual choice atomically at first login', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'new' })
    mocks.get.mockImplementation((name) => name === VISITOR_LANGUAGE_COOKIE ? { value: 'es' } : undefined)
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
    expect(mocks.sql).toHaveBeenCalled()
    expect(mocks.set).toHaveBeenCalledWith(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference('new', 'es'), expect.any(Object))
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('logout restores visitor preference and removes account ownership', async () => {
    mocks.get.mockImplementation((name) => name === VISITOR_LANGUAGE_COOKIE ? { value: 'es' } : { value: encodeAccountPreference('old', 'en') })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
    expect(mocks.remove).toHaveBeenCalledWith(ACCOUNT_LANGUAGE_COOKIE)
    expect(mocks.remove).not.toHaveBeenCalledWith(VISITOR_LANGUAGE_COOKIE)
  })
  it('a direct account switch cannot adopt a prior account language', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'new' })
    mocks.get.mockImplementation((name) => ({ value: name === VISITOR_LANGUAGE_COOKIE ? 'es' : encodeAccountPreference('old', 'es') }))
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'en', preference: 'auto' })
    expect(mocks.set).toHaveBeenCalledWith(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference('new', 'auto'), expect.any(Object))
  })
  it('retains an owner-bound selection before profile completion and persists it on retry', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'new' })
    mocks.get.mockImplementation((name) => name === ACCOUNT_LANGUAGE_COOKIE ? { value: encodeAccountPreference('new', 'es') } : undefined)
    mocks.complete.mockResolvedValueOnce({ kind: 'incomplete' }).mockResolvedValueOnce({ kind: 'available', profile: { language_preference: null } })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
    expect(mocks.complete).toHaveBeenCalledTimes(2)
    expect(mocks.sql).toHaveBeenCalledTimes(1)
    expect(mocks.set).toHaveBeenLastCalledWith(ACCOUNT_LANGUAGE_COOKIE, encodeAccountPreference('new', 'es'), expect.any(Object))
  })
  it('reads back a setting changed concurrently instead of overwriting it', async () => {
    mocks.identity.mockResolvedValue({ clerkUserId: 'a' })
    mocks.read.mockResolvedValueOnce('es')
    expect(await synchronizeLanguagePreference()).toEqual({ ok: true, locale: 'es', preference: 'es' })
  })
})
