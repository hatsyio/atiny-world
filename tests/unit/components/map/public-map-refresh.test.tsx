/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicMapController } from '@/components/map/public-map-controller'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/map/public-map-loader', () => ({
  PublicMapLoader: ({ onViewportChange }: {
    onViewportChange: (bounds: { west: number; south: number; east: number; north: number }) => void
  }) => (
    <button type="button" onClick={() => onViewportChange({ west: -4, south: 40, east: -3, north: 41 })}>
      Set viewport
    </button>
  ),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('PublicMapController', () => {
  it('recarga el viewport actual cuando se publica una carta', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ features: [] })),
    )
    vi.stubGlobal('fetch', fetch)

    const { getByRole } = render(<PublicMapController />)
    act(() => getByRole('button', { name: 'Set viewport' }).click())
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/map/features?west=-4&south=40&east=-3&north=41',
      expect.objectContaining({ cache: 'no-store' }),
    ))

    const before = fetch.mock.calls.length
    act(() => window.dispatchEvent(new Event('atiny:message-published')))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(before + 1))
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/map/features?west=-4&south=40&east=-3&north=41')
  })

  it('mantiene la zona de avisos al fallar y reintentar la carga del mapa', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [] })))
    vi.stubGlobal('fetch', fetch)

    const { container, getByRole, queryByRole } = render(<PublicMapController />)
    const feedback = container.querySelector('.map-feedback')
    expect(feedback).not.toBeNull()

    await waitFor(() => expect(getByRole('status')).toHaveTextContent('No se pudieron cargar los mensajes del mapa.'))
    getByRole('button', { name: 'Reintentar' }).click()

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queryByRole('status')).toBeNull())
    expect(container.querySelector('.map-feedback')).toBe(feedback)
  })
})
