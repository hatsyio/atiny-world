/** @vitest-environment jsdom */

import { cleanup, fireEvent,  screen, waitFor } from '@testing-library/react'
import { render } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { okResult } from '@/domain/contracts'
import { EditMessageForm, type EditMessageSubmit } from '@/components/messages/edit-message-form'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))

vi.mock('@/components/map/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ selectionId: 'new-location-token', precision: 'approximate' })}
    >
      Choose a new place
    </button>
  ),
}))

const message = {
  publicId: '00000000-0000-4000-8000-000000000001',
  version: 4,
  content: 'Carta original',
  locality: null,
  country: 'España',
  precision: 'approximate' as const,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EditMessageForm', () => {
  it('preserves the existing point by omitting location for a text-only edit', async () => {
    const submitUpdate = vi.fn<EditMessageSubmit>(async (input) =>
      okResult({ publicId: input.publicId, version: input.expectedVersion + 1, status: 'pending' as const }))
    render(<EditMessageForm lang="es" message={message} submitUpdate={submitUpdate} />)

    fireEvent.change(screen.getByRole('textbox', { name: /carta/i }), {
      target: { value: 'Carta corregida' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(submitUpdate).toHaveBeenCalledTimes(1))
    expect(submitUpdate).toHaveBeenCalledWith({
      publicId: message.publicId,
      expectedVersion: message.version,
      content: 'Carta corregida',
    })
    expect(submitUpdate.mock.calls[0]?.[0]).not.toHaveProperty('location')
    expect(push).toHaveBeenCalledWith('/my-messages')
  })

  it('replaces the point only after a new place is selected', async () => {
    const submitUpdate = vi.fn<EditMessageSubmit>(async (input) =>
      okResult({ publicId: input.publicId, version: input.expectedVersion + 1, status: 'pending' as const }))
    render(<EditMessageForm message={message} submitUpdate={submitUpdate} />)

    fireEvent.change(screen.getByRole('textbox', { name: /letter/i }), {
      target: { value: 'Updated letter' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Choose a new place' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(submitUpdate).toHaveBeenCalledTimes(1))
    expect(submitUpdate).toHaveBeenCalledWith({
      publicId: message.publicId,
      expectedVersion: message.version,
      content: 'Updated letter',
      location: { selectionId: 'new-location-token', precision: 'approximate' },
    })
  })

  it('shows a version conflict and stays on the form', async () => {
    const submitUpdate = vi.fn<EditMessageSubmit>(async () => ({
      ok: false,
      error: { code: 'MESSAGE_VERSION_CONFLICT', messageKey: 'message.versionConflict' },
    }))
    render(<EditMessageForm message={message} submitUpdate={submitUpdate} />)

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(push).not.toHaveBeenCalled()
  })
})

it.each(['en', 'es'] as const)('cancels directly to own letters in %s without submitting', lang => {
  const submitUpdate = vi.fn()
  render(<EditMessageForm lang={lang} message={message} submitUpdate={submitUpdate} />)
  fireEvent.click(screen.getByRole('button', { name: lang === 'es' ? 'Cancelar' : 'Cancel' }))
  expect(push).toHaveBeenCalledWith('/my-messages')
  expect(submitUpdate).not.toHaveBeenCalled()
})

it('returns to reading in place after saving when embedded in the detail', async () => {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  const submitUpdate = vi.fn<EditMessageSubmit>(async input =>
    okResult({ publicId: input.publicId, version: input.expectedVersion + 1, status: 'pending' as const }))
  render(<EditMessageForm message={message} submitUpdate={submitUpdate} onSaved={onSaved} onCancel={onCancel} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(push).not.toHaveBeenCalled()
})

it('cancels an embedded edit without navigating or saving', () => {
  const onCancel = vi.fn()
  const submitUpdate = vi.fn()
  render(<EditMessageForm message={message} submitUpdate={submitUpdate} onCancel={onCancel} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(submitUpdate).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
})
