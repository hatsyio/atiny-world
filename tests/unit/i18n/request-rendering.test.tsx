/** @vitest-environment jsdom */
import { act, type PropsWithChildren } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { resolveLanguage } from '../../../src/i18n/locale'

const state = vi.hoisted(() => ({ language: { locale: 'en' as 'en' | 'es', preference: 'auto' as const } }))
vi.mock('@/i18n/preference', () => ({ getRequestLanguage: async () => state.language }))
vi.mock('next/font/google', () => ({ Fraunces: () => ({ variable: 'display' }), Manrope: () => ({ variable: 'interface' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/' }))
vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children, localization }: PropsWithChildren<{ localization: { locale: string } }>) => <div data-auth-locale={localization.locale}>{children}</div>,
  useAuth: () => ({ isLoaded: false, userId: null }),
}))
vi.mock('@/server/actions/language-preference', () => ({ synchronizeLanguagePreference: vi.fn() }))
import RootLayout, { generateMetadata } from '../../../src/app/layout'
import { PublicMessageCard } from '../../../src/components/messages/public-message-card'
import type { PublicMessageDetail } from '../../../src/domain/messages/public-message'

const message: PublicMessageDetail = {
  publicId: 'letter', content: '에이티즈 👩🏽‍🚀\n같은 하늘 🏳️‍🌈', author: { publicId: 'fan', displayName: 'ATINY' },
  locality: 'Seoul', country: 'South Korea', countryCode: 'kr', publishedAt: '2026-10-04T23:59:00Z',
  point: { latitude: 37.56, longitude: 126.97 }, precision: 'approximate',
}

describe('server and hydrated reader language', () => {
  it.each([
    ['es-MX,en;q=0.8', 'es', 'es-ES', '4 de octubre de 2026'],
    ['ko,fr;q=0.8', 'en', 'en-US', 'October 4, 2026'],
  ] as const)('keeps the first HTML and hydration aligned for %s', async (header, locale, clerkLocale, date) => {
    state.language = resolveLanguage({ userId: null, acceptLanguage: header }) as typeof state.language
    const tree = await RootLayout({ children: <PublicMessageCard message={message} /> })
    const html = renderToString(tree)
    expect(html).toContain(`<html lang="${locale}"`)
    expect(html).toContain(`data-auth-locale="${clerkLocale}"`)
    expect(html).toContain(date)
    expect(html).toContain(message.content)
    const errors: unknown[] = []
    document.open(); document.write(`<!DOCTYPE html>${html}`); document.close()
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => { root = hydrateRoot(document, tree, { onRecoverableError: error => errors.push(error) }) })
    expect(errors).toEqual([])
    expect(document.documentElement.lang).toBe(locale)
    expect(document.querySelector('article p')?.textContent).toBe(message.content)
    expect((await generateMetadata()).description).toBe(locale === 'es' ? 'Un mundo de buenos deseos para ATEEZ.' : 'A world of good wishes for ATEEZ.')
    await act(async () => { root?.unmount() })
  })
})
