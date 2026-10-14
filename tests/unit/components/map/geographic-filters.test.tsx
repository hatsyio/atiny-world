/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render } from '../../../support/intl'
import { MapFilters, type MapFilterValues } from '@/components/map/map-filters'
const madrid = { id: 'city:madrid', kind: 'city', name: 'Madrid', country: 'Spain', countryCode: 'es', point: { latitude: 40.4, longitude: -3.7 }, bounds: null, providerId: null, provider: 'Geoapify', attribution: 'Geoapify', obtainedAt: '2026-10-14T00:00:00Z' }
const catalog = [{ city: 'Madrid', country: 'es' }, { city: 'Barcelona', country: 'es' }]
function Harness({ onChange = () => {} }: { onChange?: (value: MapFilterValues) => void }) {
  const [value, setValue] = useState<MapFilterValues>({ country: 'es' })
  return <MapFilters value={value} onChange={next => { setValue(next); onChange(next) }} />
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('offers only countries from public letters and no search button', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ locations: catalog })))
  render(<MapFilters value={{}} onChange={() => {}} />)
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByRole('group', { name: 'Filters' })).toHaveAttribute('aria-busy', 'false'))
  expect(screen.queryByRole('button', { name: 'Find city' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Country/ }))
  expect(screen.getByRole('option', { name: 'Spain' })).toBeVisible()
  expect(screen.queryByRole('option', { name: 'Andorra' })).not.toBeInTheDocument()
})
it('resolves and applies a single database locality immediately on selecting it', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json({ locations: url === '/api/map/filter-options' ? catalog : [madrid] })))
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Madrid' }))
  await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ city: 'Madrid', country: 'es', locationId: madrid.id }))
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/map/locations?city=Madrid&country=es')).toBe(true)
  expect(screen.queryByRole('button', { name: /Madrid · Spain/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})
it('filters while typing without querying geography and ignores an obsolete selected locality', async () => {
  let resolveMadrid!: (response: Response) => void
  let signal: AbortSignal | null | undefined
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/map/filter-options') return Promise.resolve(Response.json({ locations: catalog }))
    if (url.includes('Madrid')) { signal = init?.signal; return new Promise<Response>(done => { resolveMadrid = done }) }
    return Promise.resolve(Response.json({ locations: [{ ...madrid, name: 'Barcelona', id: 'city:barcelona' }] }))
  }))
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  const user = userEvent.setup()
  const input = screen.getByRole('combobox', { name: 'City' })
  await user.type(input, 'Mad')
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith('/api/map/locations'))).toBe(false)
  await user.click(await screen.findByRole('option', { name: 'Madrid' }))
  await waitFor(() => expect(resolveMadrid).toBeTypeOf('function'))
  expect(signal?.aborted).toBe(false)
  fireEvent.change(input, { target: { value: 'Bar' } })
  await user.click(await screen.findByRole('option', { name: 'Barcelona' }))
  await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ city: 'Barcelona', country: 'es', locationId: 'city:barcelona' }))
  await act(async () => resolveMadrid(Response.json({ locations: [madrid] })))
  expect(onChange.mock.calls.some(([value]) => value.locationId === madrid.id)).toBe(false)
})
it('keeps same-named catalog localities in different countries distinct', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json({ locations: url === '/api/map/filter-options' ? [{ city: 'Madrid', country: 'es' }, { city: 'Madrid', country: 'us' }] : [madrid] })))
  render(<MapFilters value={{}} onChange={() => {}} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'City' }))
  expect(await screen.findByRole('option', { name: 'Madrid · Spain' })).toBeVisible()
  expect(screen.getByRole('option', { name: 'Madrid · United States' })).toBeVisible()
  await user.click(screen.getByRole('option', { name: 'Madrid · Spain' }))
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('city=Madrid&country=es'))).toBe(true))
})
it('does not override a later locality applied by another filter instance', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/map/filter-options' ? Promise.resolve(Response.json({ locations: catalog })) : new Promise<Response>(done => { resolve = done })))
  const onChange = vi.fn()
  const page = render(<MapFilters value={{ country: 'es' }} onChange={onChange} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Madrid' }))
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  page.rerender(<MapFilters value={{ country: 'es', city: 'Barcelona', locationId: 'city:barcelona' }} onChange={onChange} />)
  await act(async () => resolve(Response.json({ locations: [madrid] })))
  expect(onChange.mock.calls.some(([value]) => value.locationId === madrid.id)).toBe(false)
  expect(screen.getByRole('combobox', { name: 'City' })).toHaveValue('Barcelona')
})

it('cancels a pending locality when another instance selects its country', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/map/filter-options' ? Promise.resolve(Response.json({ locations: catalog })) : new Promise<Response>(done => { resolve = done })))
  const onChange = vi.fn()
  const page = render(<MapFilters value={{}} onChange={onChange} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'City' }))
  await user.click(await screen.findByRole('option', { name: 'Madrid' }))
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  page.rerender(<MapFilters value={{ city: 'Madrid' }} onChange={onChange} />)
  page.rerender(<MapFilters value={{ country: 'es', city: 'Madrid' }} onChange={onChange} />)
  await act(async () => resolve(Response.json({ locations: [madrid] })))
  expect(onChange.mock.calls.some(([value]) => value.locationId === madrid.id)).toBe(false)
})
