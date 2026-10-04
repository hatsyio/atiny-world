/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup,  waitFor } from '@testing-library/react'
import { render } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicMapController } from '@/components/map/public-map-controller'

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock('@/components/map/public-map-loader', () => ({
  PublicMapLoader: ({ onViewportChange, onFiltersChange, groupRequestUrl, onSelect, onViewChange, initialView }: {
    onSelect: (id: string) => void
    onViewChange: (view: { latitude: number; longitude: number; zoom: number }) => void
    initialView?: { latitude: number; longitude: number; zoom: number }
    onViewportChange: (bounds: { west: number; south: number; east: number; north: number }) => void
    onFiltersChange: (filters: { city: string; country: string }) => void
    groupRequestUrl: string
  }) => (
    <div>
      <span aria-label="Initial view">{JSON.stringify(initialView)}</span>
      <button onClick={() => onViewChange({ latitude: 40.5, longitude: -3.5, zoom: 8 })}>Set view</button>
      <button onClick={() => onSelect('letter-1')}>Read letter</button>
      <button type="button" onClick={() => onViewportChange({ west: -4, south: 40, east: -3, north: 41 })}>Set viewport</button>
      <button type="button" onClick={() => onFiltersChange({ city: 'Madrid', country: 'es' })}>Set filters</button>
      <span>{groupRequestUrl}</span>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  navigation.push.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('PublicMapController', () => {
  it('passes map filters to both feature and message requests', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ features: [] })),
    )
    vi.stubGlobal('fetch', fetch)

    const { getByRole, getByText, queryByRole } = render(<PublicMapController />)
    expect(queryByRole('group', { name: 'Filtros' })).toBeNull()
    act(() => getByRole('button', { name: 'Set filters' }).click())

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/map/features?west=-180&south=-90&east=180&north=90&city=Madrid&country=es',
      expect.objectContaining({ cache: 'no-store' }),
    ))
    expect(getByText('/api/map/messages?west=-180&south=-90&east=180&north=90&city=Madrid&country=es&limit=20')).toBeTruthy()
  })

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

    await waitFor(() => expect(getByRole('status')).toHaveTextContent('The map messages could not be loaded.'))
    getByRole('button', { name: 'Try again' }).click()

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(queryByRole('status')).toBeNull())
    expect(container.querySelector('.map-feedback')).toBe(feedback)
  })
})


it('restores viewport, zoom and filters after map → letter → map, including browser Back', async () => {
  window.history.replaceState(null, '', '/')
  const view = render(<PublicMapController lang="es" />)
  act(() => view.getByRole('button', { name: 'Set view' }).click())
  act(() => view.getByRole('button', { name: 'Set filters' }).click())
  act(() => view.getByRole('button', { name: 'Read letter' }).click())
  const origin = '/?mapView=40.5%2C-3.5%2C8&mapCity=Madrid&mapCountry=es#map'
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(origin)
  const detail = navigation.push.mock.calls[0][0] as string
  expect(new URL(detail, window.location.origin).searchParams.get('returnTo')).toBe(origin)
  view.unmount()
  // The browser's previous entry and the explicit return control both resolve to this URL.
  const restored = render(<PublicMapController lang="es" />)
  expect(restored.getByLabelText('Initial view')).toHaveTextContent('{"latitude":40.5,"longitude":-3.5,"zoom":8}')
  expect(restored.getByText(/city=Madrid&country=es&limit=20/)).toBeInTheDocument()
  restored.unmount()
  window.history.replaceState(null, '', '/')
  const fresh = render(<PublicMapController lang="es" />)
  expect(fresh.getByLabelText('Initial view')).toHaveTextContent('{"latitude":20,"longitude":0,"zoom":2}')
  expect(fresh.queryByText(/city=Madrid/)).toBeNull()
})

it('starts a fresh exploration when navigating to the same home route without saved context', () => {
  window.history.replaceState(null, '', '/?mapView=40.5,-3.5,8&mapCity=Madrid&mapCountry=es#map')
  const page = render(<PublicMapController lang="es" />)
  expect(page.getByLabelText('Initial view')).toHaveTextContent('"zoom":8')
  window.history.replaceState(null, '', '/#map')
  page.rerender(<PublicMapController lang="es" />)
  expect(page.getByLabelText('Initial view')).toHaveTextContent('"zoom":2')
  expect(page.queryByText(/city=Madrid/)).toBeNull()
})
