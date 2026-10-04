// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { LanguageSwitcher } from '../../../src/components/i18n/language-switcher'
import { LanguagePreferenceProvider } from '../../../src/components/i18n/language-context'
import { loadMessages } from '../../../src/i18n/messages'

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/server/actions/language-preference', () => ({ setLanguagePreference: mocks.save }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('accessible language selector', () => {
  it('saves auto and refreshes while preserving draft DOM state and original content', async () => {
    mocks.save.mockResolvedValue({ ok: true })
    render(<NextIntlClientProvider locale="en" messages={loadMessages('en')} timeZone="UTC"><LanguagePreferenceProvider preference="es"><LanguageSwitcher /><textarea aria-label="Letter draft" defaultValue={'서울 🌙\nATINY'} /></LanguagePreferenceProvider></NextIntlClientProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'auto' } })
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledWith('auto')
    expect(screen.getByRole('textbox', { name: 'Letter draft' })).toHaveValue('서울 🌙\nATINY')
    expect(screen.getByRole('status')).toHaveTextContent('Language saved.')
  })
  it('announces a failed persistence attempt without refreshing', async () => {
    mocks.save.mockResolvedValue({ ok: false })
    render(<NextIntlClientProvider locale="es" messages={loadMessages('es')} timeZone="UTC"><LanguageSwitcher /></NextIntlClientProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo guardar el idioma.'))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
