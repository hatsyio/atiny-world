/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateMessageFlow } from '@/components/messages/create-message-flow'
import type { CreateMessageSubmit } from '@/components/messages/create-message-form'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const picker = vi.hoisted(() => ({ onChange: null as ((value: unknown) => void) | null }))

vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
vi.mock('@/components/map/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (value: unknown) => void }) => {
    picker.onChange = onChange
    return <div />
  },
}))
vi.mock('@/app/[lang]/actions/create-message', () => ({ createMessageAction: vi.fn() }))

afterEach(() => {
  cleanup()
  navigation.push.mockReset()
  navigation.refresh.mockReset()
})

async function publish(publicVisible: boolean) {
  const submitMessage: CreateMessageSubmit = async () => ({
    ok: true,
    data: { publicId: 'stable-id', version: 1, status: 'pending', publicVisible },
  })
  const refreshed = vi.fn()
  window.addEventListener('atiny:message-published', refreshed)
  try {
    render(<CreateMessageFlow lang="es" submitMessage={submitMessage} />)
    fireEvent.change(screen.getByLabelText('Tu carta'), { target: { value: 'Hola ATINY' } })
    act(() => picker.onChange?.({ selectionId: 'place', precision: 'approximate' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publicar carta' })))
    return refreshed
  } finally {
    window.removeEventListener('atiny:message-published', refreshed)
  }
}

describe('CreateMessageFlow', () => {
  it('refresca el mapa y abre el enlace estable en el idioma actual si la carta es pública', async () => {
    const refreshed = await publish(true)
    expect(refreshed).toHaveBeenCalledOnce()
    expect(navigation.refresh).toHaveBeenCalledOnce()
    expect(navigation.push).toHaveBeenCalledWith('/es/messages/stable-id')
  })

  it('refresca el mapa y muestra el estado pendiente sin abrir el enlace oculto', async () => {
    const refreshed = await publish(false)
    expect(refreshed).toHaveBeenCalledOnce()
    expect(navigation.refresh).toHaveBeenCalledOnce()
    expect(navigation.push).toHaveBeenCalledWith('/es?publication=pending#map')
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })
})
