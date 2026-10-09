/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { MapExplorer } from '@/components/map/map-explorer'
import type { LeafletMapProps } from '@/components/map/leaflet-map'

const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock('@/components/map/public-map-loader', () => ({ PublicMapLoader: (props: LeafletMapProps) => <div>
  <span aria-label="Initial view">{JSON.stringify(props.initialView)}</span>
  <span aria-label="Selected marker">{props.selectedPublicId}</span>
  <span aria-label="Markers">{props.features.map(feature => feature.publicId).join(',')}</span>
  <button onClick={() => { props.onViewChange?.({ latitude: 40.5, longitude: -3.5, zoom: 10 }); props.onViewportChange?.({ west: -4, south: 40, east: -3, north: 41 }) }}>Move map</button>
  <button onClick={() => props.onSelect('letter-1')}>Read full message</button>
</div> }))
const message = { publicId: 'letter-1', content: 'Hello from Madrid', point: { latitude: 40.4, longitude: -3.7 }, precision: 'approximate', locality: 'Madrid', country: 'España', countryCode: 'es', publishedAt: '2026-10-01T10:00:00Z', author: { publicId: 'author', displayName: 'Fan' } }
beforeEach(() => {
  window.history.replaceState(null, '', '/map')
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.startsWith('/api/messages/') ? message : url.startsWith('/api/map/features') ? { features: [] } : { items: [message], nextCursor: null }))))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); navigation.push.mockReset() })

it('loads the visible area, previews a panel letter omitted from markers and preserves context on reading', async () => {
  render(<MapExplorer />)
  // No world-wide letter download before the map has reported its viewport.
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Move map' }))
  fireEvent.click(await screen.findByRole('button', { name: /Hello from Madrid/ }))
  await waitFor(() => expect(screen.getByLabelText('Selected marker')).toHaveTextContent('letter-1'))
  expect(screen.getByLabelText('Markers')).toHaveTextContent('letter-1')
  expect(navigation.push).not.toHaveBeenCalled()
  expect(new URLSearchParams(window.location.search).get('mapView')).toBe('40.5,-3.5,10')
  expect(new URLSearchParams(window.location.search).get('letter')).toBe('letter-1')
  fireEvent.click(screen.getByRole('button', { name: 'Read full message' }))
  const detail = new URL(navigation.push.mock.calls[0][0], window.location.origin)
  expect(detail.searchParams.get('returnTo')).toBe(window.location.pathname + window.location.search + '#map')
})

it('restores the saved view, filters and selected letter on reload', async () => {
  window.history.replaceState(null, '', '/map?mapView=40.5,-3.5,10&mapCity=Madrid&mapCountry=es&letter=letter-1#map')
  render(<MapExplorer />)
  expect(screen.getByLabelText('Initial view')).toHaveTextContent('"zoom":10')
  expect(screen.getByRole('textbox', { name: 'City' })).toHaveValue('Madrid')
  expect(screen.getByRole('button', { name: /Country/ })).toHaveTextContent('Spain')
  await waitFor(() => expect(screen.getByLabelText('Selected marker')).toHaveTextContent('letter-1'))
})

it('applies city typing once to markers and panel, then clears both filters', async () => {
  render(<MapExplorer />)
  fireEvent.click(screen.getByRole('button', { name: 'Move map' }))
  await screen.findByRole('button', { name: /Hello from Madrid/ })
  const city = screen.getByRole('textbox', { name: 'City' })
  fireEvent.change(city, { target: { value: 'Mad' } })
  fireEvent.change(city, { target: { value: 'Madrid' } })
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('city=Mad'))).toBe(false)
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('city=Madrid'))).toHaveLength(2))
  expect(vi.mocked(fetch).mock.calls.some(([url]) => new URL(String(url), window.location.origin).searchParams.get('city') === 'Mad')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(city).toHaveValue('')
  await waitFor(() => expect(new URLSearchParams(window.location.search).has('mapCity')).toBe(false))
})

it('reports an unavailable linked letter while leaving exploration usable', async () => {
  window.history.replaceState(null, '', '/map?letter=removed')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
  render(<MapExplorer />, { locale: 'es' })
  expect(await screen.findByText('Esta carta ya no está disponible públicamente.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Move map' })).toBeEnabled()
})

it('reacts to browser navigation without remounting on its own URL updates', async () => {
  const page = render(<MapExplorer />)
  fireEvent.click(screen.getByRole('button', { name: 'Move map' }))
  await screen.findByRole('button', { name: /Hello from Madrid/ })
  page.rerender(<MapExplorer />)
  expect(screen.getByRole('button', { name: /Hello from Madrid/ })).toBeVisible()
  act(() => { window.history.replaceState(null, '', '/map?mapView=10,20,5&mapCity=Seoul'); window.dispatchEvent(new PopStateEvent('popstate')) })
  expect(screen.getByLabelText('Initial view')).toHaveTextContent('"zoom":5')
  expect(screen.getByRole('textbox', { name: 'City' })).toHaveValue('Seoul')
})
