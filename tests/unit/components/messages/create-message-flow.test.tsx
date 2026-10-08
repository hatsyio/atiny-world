/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { act } from 'react'
import { cleanup, fireEvent,  screen } from '@testing-library/react'
import { render, IntlTestProvider } from '../../../support/intl'
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
vi.mock('@/app/(site)/actions/create-message', () => ({ createMessageAction: vi.fn() }))

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
  const client = new QueryClient()
  const key = [...publicMapQueryKey, 'features', 'viewport']
  client.setQueryData(key, { features: [] })
  try {
    render(<IntlTestProvider locale="es"><QueryClientProvider client={client}><CreateMessageFlow submitMessage={submitMessage} /></QueryClientProvider></IntlTestProvider>)
    fireEvent.change(screen.getByLabelText('Tu carta'), { target: { value: 'Hola ATINY' } })
    act(() => picker.onChange?.({ selectionId: 'place', precision: 'approximate' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Publicar carta' })))
    return client.getQueryData(key)
  } finally {
    client.clear()
  }
}

describe('CreateMessageFlow', () => {
  it('refresca el mapa y abre el enlace estable en el idioma actual si la carta es pública', async () => {
    const refreshed = await publish(true)
    expect(refreshed).toBeUndefined()
    expect(navigation.refresh).toHaveBeenCalledOnce()
    expect(navigation.push).toHaveBeenCalledWith('/messages/stable-id')
  })

  it('refresca el mapa y muestra el estado pendiente sin abrir el enlace oculto', async () => {
    const refreshed = await publish(false)
    expect(refreshed).toBeUndefined()
    expect(navigation.refresh).toHaveBeenCalledOnce()
    expect(navigation.push).toHaveBeenCalledWith('/?publication=pending#map')
    expect(screen.queryByRole('link', { name: /stable-id/i })).not.toBeInTheDocument()
  })
})

describe('writing cancellation', () => {
  it.each(['en', 'es'] as const)('returns direct visitors to the map in %s', lang => {
    render(<CreateMessageFlow />, { locale: lang })
    fireEvent.click(screen.getByRole('button', { name: lang === 'es' ? 'Cancelar y volver al mapa' : 'Cancel and return to the map' }))
    expect(navigation.push).toHaveBeenCalledWith('/#map')
  })

  it('returns to a supplied own-letter origin', () => {
    render(<CreateMessageFlow returnTo="/my-messages" />, { locale: 'es' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver a mis cartas' }))
    expect(navigation.push).toHaveBeenCalledWith('/my-messages')
  })

  it.each(['https://evil.example', '//evil.example', '/messages/new', '/es/sign-in'])('falls back to the map for %s', returnTo => {
    render(<CreateMessageFlow returnTo={returnTo} />, { locale: 'es' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar y volver al mapa' }))
    expect(navigation.push).toHaveBeenCalledWith('/#map')
  })
})
