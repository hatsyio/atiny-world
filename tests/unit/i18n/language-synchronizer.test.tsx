// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguagePreferenceProvider } from '@/components/i18n/language-context'
import { LanguageSynchronizer } from '@/components/i18n/language-synchronizer'

const boundary = vi.hoisted(() => ({
  auth: { isLoaded: false, userId: null as string | null },
  pathname: '/', locale: 'en', router: { refresh: vi.fn() }, sync: vi.fn(),
  captureException: vi.fn(),
}))
vi.mock('posthog-js', () => ({ default: { captureException: boundary.captureException } }))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => boundary.auth }))
vi.mock('next/navigation', () => ({ usePathname: () => boundary.pathname, useRouter: () => boundary.router }))
vi.mock('next-intl', () => ({ useLocale: () => boundary.locale }))
vi.mock('@/server/actions/language-preference', () => ({ synchronizeLanguagePreference: boundary.sync }))

function Page({ preference = 'auto' }: { preference?: 'auto' | 'es' | 'en' }) {
  const [draft, setDraft] = useState('')
  return <LanguagePreferenceProvider preference={preference}>
    <LanguageSynchronizer />
    <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
  </LanguagePreferenceProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  boundary.auth = { isLoaded: false, userId: null }
  boundary.pathname = '/'
  boundary.locale = 'en'
  boundary.sync.mockResolvedValue({ ok: true, locale: 'en', preference: 'auto' })
})
afterEach(cleanup)

describe('language synchronization triggers and request counts', () => {
  it('handles transport failure, keeps the draft and retries on navigation', async () => {
    boundary.auth = { isLoaded: true, userId: 'a' }
    const error = new TypeError('Failed to fetch')
    boundary.sync.mockRejectedValueOnce(error)
    const page = render(<Page />)
    fireEvent.change(screen.getByRole('textbox', { name: 'draft' }), { target: { value: 'Unsent letter' } })
    await waitFor(() => expect(boundary.captureException).toHaveBeenCalledWith(error, {
      operation: 'synchronize_language_preference',
    }))
    expect(boundary.router.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('Unsent letter')
    boundary.sync.mockResolvedValue({ ok: true, locale: 'es', preference: 'es' })
    boundary.pathname = '/profile'
    page.rerender(<Page />)
    await waitFor(() => expect(boundary.router.refresh).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('Unsent letter')
  })

  it('waits for auth and synchronizes on account, logout, route and preference changes', async () => {
    const page = render(<Page />)
    expect(boundary.sync).not.toHaveBeenCalled()
    boundary.auth = { isLoaded: true, userId: null }
    page.rerender(<Page />)
    await waitFor(() => expect(boundary.sync).toHaveBeenCalledTimes(1))
    page.rerender(<Page />)
    expect(boundary.sync).toHaveBeenCalledTimes(1)
    for (const userId of ['a', 'b', null]) {
      boundary.auth = { isLoaded: true, userId }
      page.rerender(<Page />)
    }
    boundary.pathname = '/settings'
    page.rerender(<Page />)
    boundary.sync.mockResolvedValue({ ok: true, locale: 'en', preference: 'en' })
    page.rerender(<Page preference="en" />)
    await waitFor(() => expect(boundary.sync).toHaveBeenCalledTimes(6))
  })

  it('retries incomplete signup on navigation and refreshes a recovered language without losing drafts', async () => {
    boundary.auth = { isLoaded: true, userId: 'a' }
    const page = render(<Page />)
    await waitFor(() => expect(boundary.sync).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('textbox', { name: 'draft' }), { target: { value: 'Unsent letter' } })
    boundary.sync.mockResolvedValue({ ok: true, locale: 'es', preference: 'es' })
    boundary.pathname = '/profile'
    page.rerender(<Page />)
    await waitFor(() => expect(boundary.router.refresh).toHaveBeenCalledTimes(1))
    boundary.locale = 'es'
    page.rerender(<Page preference="es" />)
    await waitFor(() => expect(boundary.sync).toHaveBeenCalledTimes(3))
    expect(boundary.router.refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('Unsent letter')
  })

  it('observes another tab language on the next navigation', async () => {
    boundary.auth = { isLoaded: true, userId: 'a' }
    const page = render(<Page />)
    await waitFor(() => expect(boundary.sync).toHaveBeenCalledTimes(1))
    boundary.sync.mockResolvedValue({ ok: true, locale: 'es', preference: 'es' })
    boundary.pathname = '/letters'
    page.rerender(<Page />)
    await waitFor(() => expect(boundary.router.refresh).toHaveBeenCalledTimes(1))
    expect(boundary.sync).toHaveBeenCalledTimes(2)
  })

  it('ignores a response from the previous account after switching accounts', async () => {
    let resolveOld!: (value: { ok: boolean; locale: string; preference: string }) => void
    boundary.sync.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    boundary.auth = { isLoaded: true, userId: 'a' }
    const page = render(<Page />)
    boundary.auth = { isLoaded: true, userId: 'b' }
    page.rerender(<Page />)
    await act(async () => { resolveOld({ ok: true, locale: 'es', preference: 'es' }) })
    expect(boundary.router.refresh).not.toHaveBeenCalled()
  })
})
