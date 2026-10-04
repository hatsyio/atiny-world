/** @vitest-environment jsdom */
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { IntlTestProvider } from '../../../support/intl'
import { EditMessageForm } from '@/components/messages/edit-message-form'
import { PublicMessageCard } from '@/components/messages/public-message-card'
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))
vi.mock('@/components/map/location-picker', () => ({LocationPicker: () => null}))
afterEach(cleanup)
it('switches labels and UTC publication date while preserving a Korean draft and UGC', () => {
 const content = '안녕하세요 👨‍👩‍👧‍👦\n함께해요'
 const message = {publicId:'test', version:1, content, locality:'서울', country:'한국', precision:'approximate' as const}
 const publicMessage = {...message, countryCode:'kr', publishedAt:'2026-01-02T00:30:00Z', author:{publicId:'author', displayName:'ATINY'}, point:{latitude:0, longitude:0}}
 const view = (locale:'en'|'es') => <IntlTestProvider locale={locale}><EditMessageForm message={message}/><PublicMessageCard message={publicMessage}/></IntlTestProvider>
 const result = render(view('en'))
 fireEvent.change(screen.getByRole('textbox', {name:'Your letter'}), {target:{value:content+'!'}})
 expect(screen.getByText('January 2, 2026')).toBeVisible()
 result.rerender(view('es'))
 expect(screen.getByRole('textbox', {name:'Tu carta'})).toHaveValue(content+'!')
 expect(screen.getByText('2 de enero de 2026')).toBeVisible()
 expect(result.container.querySelector('article p')?.textContent).toBe(content)
})
