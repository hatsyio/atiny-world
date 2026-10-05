/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { EditMessageForm } from '@/components/messages/edit-message-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))
const message = {
  publicId: 'letter-1', version: 4, content: 'My letter', precision: 'approximate' as const,
  locality: 'Madrid', country: 'España', point: { latitude: 40.4, longitude: -3.7 },
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('blocks saving an unfinished replacement and preserves the original when the search is cleared', () => {
  const submitUpdate = vi.fn()
  render(<EditMessageForm message={message} submitUpdate={submitUpdate} />)
  const save = screen.getByRole('button', { name: 'Save changes' })
  const search = screen.getByRole('textbox', { name: 'Search for a city or area' })
  expect(save).toBeEnabled()
  fireEvent.change(search, { target: { value: 'Seoul' } })
  expect(save).toBeDisabled()
  fireEvent.click(save)
  expect(submitUpdate).not.toHaveBeenCalled()
  fireEvent.change(search, { target: { value: '' } })
  expect(save).toBeEnabled()
})
it('blocks saving an exact replacement until its public point is confirmed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ suggestions: [{
    locality: 'Seoul', country: 'South Korea', countryCode: 'kr',
    point: { latitude: 37.5665, longitude: 126.978 },
    sourceAttribution: { label: 'Geoapify', url: 'https://www.geoapify.com/' }, selectionToken: 'seoul-token',
  }] }), { status: 200, headers: { 'content-type': 'application/json' } })))
  const submitUpdate = vi.fn(async () => ({ ok: false as const, error: { code: 'MESSAGE_VERSION_CONFLICT' as const, messageKey: 'message.versionConflict' } }))
  render(<EditMessageForm message={message} submitUpdate={submitUpdate} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search for a city or area' }), { target: { value: 'Seoul' } })
  fireEvent.click(await screen.findByRole('option', { name: 'Seoul, South Korea' }))
  const save = screen.getByRole('button', { name: 'Save changes' })
  expect(save).toBeEnabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Exact location' }))
  expect(save).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'I understand, make this point public' }))
  expect(save).toBeEnabled()
  fireEvent.click(save)
  await waitFor(() => expect(submitUpdate).toHaveBeenCalledWith({
    publicId: 'letter-1', expectedVersion: 4, content: 'My letter',
    location: { selectionId: 'seoul-token', precision: 'precise', confirmedPublicPoint: { latitude: 37.5665, longitude: 126.978 }, preciseLocationConfirmed: true },
  }))
})
