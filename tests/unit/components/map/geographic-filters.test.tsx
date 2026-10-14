/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { MapFilters } from '@/components/map/map-filters'
const city = { id: 'city:madrid', kind: 'city', name: 'Madrid', country: 'Spain', countryCode: 'es', point: { latitude: 40.4, longitude: -3.7 }, bounds: null, providerId: null, provider: 'Geoapify', attribution: 'Geoapify', obtainedAt: '2026-10-14T00:00:00Z' }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('keeps the explicit request alive when selecting a catalog suggestion changes the input', async () => {
  let resolve!: (response: Response) => void
  let signal: AbortSignal | null | undefined
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/map/filter-options') return Promise.resolve(Response.json({ locations: [{ city: 'Madrid', country: 'es' }] }))
    signal = init?.signal
    return new Promise<Response>(done => { resolve = done })
  }))
  const onChange = vi.fn()
  render(<MapFilters value={{ country: 'es' }} onChange={onChange} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Madrid' }))
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  expect(signal?.aborted).toBe(false)
  await act(async () => resolve(Response.json({ locations: [city] })))
  await user.click(await screen.findByRole('button', { name: /Madrid · Spain/ }))
  expect(onChange).toHaveBeenLastCalledWith({ city: 'Madrid', country: 'es', locationId: city.id })
})
it('ignores late results when a new search replaces the previous location', async () => {
  let resolveMadrid!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url === '/api/map/filter-options') return Promise.resolve(Response.json({ locations: [] }))
    if (url.includes('Madrid')) return new Promise<Response>(done => { resolveMadrid = done })
    return Promise.resolve(Response.json({ locations: [{ ...city, id: 'city:barcelona', name: 'Barcelona' }] }))
  }))
  render(<MapFilters value={{ country: 'es' }} onChange={() => {}} />)
  const input = screen.getByRole('combobox', { name: 'City' })
  fireEvent.change(input, { target: { value: 'Madrid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find city' }))
  fireEvent.change(input, { target: { value: 'Barcelona' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find city' }))
  expect(await screen.findByRole('button', { name: /Barcelona · Spain/ })).toBeVisible()
  await act(async () => resolveMadrid(Response.json({ locations: [city] })))
  expect(screen.queryByRole('button', { name: /Madrid · Spain/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Barcelona · Spain/ })).toBeVisible()
})
it('allows retrying an aborted search after returning to the same input', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/map/filter-options' ? Promise.resolve(Response.json({ locations: [] })) : new Promise<Response>(() => {})))
  render(<MapFilters value={{ country: 'es' }} onChange={() => {}} />)
  const input = screen.getByRole('combobox', { name: 'City' })
  fireEvent.change(input, { target: { value: 'Madrid' } })
  const search = screen.getByRole('button', { name: 'Find city' })
  fireEvent.click(search)
  expect(search).toBeDisabled()
  fireEvent.change(input, { target: { value: 'Mad' } })
  fireEvent.change(input, { target: { value: 'Madrid' } })
  expect(search).toBeEnabled()
  fireEvent.click(search)
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith('/api/map/locations'))).toHaveLength(2)
})
it('does not start a geographic request when a restored city appears in the letter catalog', async () => {
  const fetcher = vi.fn(async () => Response.json({ locations: [{ country: 'es', city: 'Madrid' }] }))
  vi.stubGlobal('fetch', fetcher)
  render(<MapFilters value={{ country: 'es', city: 'Madrid' }} onChange={() => {}} />)
  await waitFor(() => expect(screen.getByRole('group', { name: 'Filters' })).toHaveAttribute('aria-busy', 'false'))
  expect(fetcher.mock.calls).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Find city' })).toBeEnabled()
})
