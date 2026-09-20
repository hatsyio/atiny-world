/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocationPicker, type LocationPickerSelection } from '@/components/map/location-picker'

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const advance = (ms: number) => vi.advanceTimersByTime(ms)

const leafletCallbacks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  return { handlers }
})

vi.mock('leaflet', () => {
  const marker = {
    on(event: string, handler: (...args: unknown[]) => void) {
      leafletCallbacks.handlers.set(event, handler)
    },
    getLatLng: () => ({ lat: 40.51, lng: -3.72 }),
    addTo: () => marker,
  }
  const map = {
    setView: () => map,
    remove: () => {},
  }
  const tileLayer = () => ({ addTo: () => {} })
  return {
    default: { map: () => map, marker: () => marker, tileLayer },
    map: () => map,
    marker: () => marker,
    tileLayer,
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function suggestionsResponse(suggestions: unknown[]) {
  return new Response(JSON.stringify({ suggestions }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const seoulSuggestion = {
  locality: 'Seoul',
  country: 'South Korea',
  countryCode: 'kr',
  point: { latitude: 37.5665, longitude: 126.978 },
  sourceAttribution: { label: 'Geoapify', url: 'https://www.geoapify.com/' },
  selectionToken: 'opaque-selection-1',
}

const madridSuggestion = {
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  point: { latitude: 40.4167, longitude: -3.7033 },
  sourceAttribution: { label: 'Geoapify', url: 'https://www.geoapify.com/' },
  selectionToken: 'opaque-selection-2',
}

function stubFetch(requests: Array<ReturnType<typeof deferred<Response>>>) {
  const fetchMock = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
    void args
    const request = deferred<Response>()
    requests.push(request)
    return request.promise
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function resolveSearch(request: ReturnType<typeof deferred<Response>>, response: Response) {
  request.resolve(response)
  await act(async () => { await request.promise })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  leafletCallbacks.handlers.clear()
})

describe('LocationPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('debounces typing and sends one search with the latest text', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    const fetchMock = stubFetch(requests)

    render(<LocationPicker lang="es" onChange={() => {}} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'Seo' } })
    await act(async () => { advance(300) })
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const passedInit = fetchMock.mock.calls[0][1]!
    expect(JSON.parse(passedInit.body as string)).toEqual({ query: 'Seoul', language: 'es' })

    await resolveSearch(requests[0], suggestionsResponse([seoulSuggestion]))
  })

  it('ignores a stale response that resolves after a newer search', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    const fetchMock = stubFetch(requests)

    render(<LocationPicker onChange={() => {}} />)
    const input = screen.getByLabelText(/search/i)

    fireEvent.change(input, { target: { value: 'Seo' } })
    await act(async () => { advance(400) })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await resolveSearch(requests[1], suggestionsResponse([seoulSuggestion]))
    expect(screen.getByRole('option', { name: 'Seoul, South Korea' })).toBeTruthy()

    await resolveSearch(requests[0], suggestionsResponse([madridSuggestion]))
    expect(screen.queryByRole('option', { name: 'Madrid, España' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Seoul, South Korea' })).toBeTruthy()
  })

  it('announces loading, empty and rate-limited states', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    stubFetch(requests)

    render(<LocationPicker lang="es" onChange={() => {}} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'Seou' } })
    await act(async () => { advance(400) })
    expect(screen.getByRole('status')).toHaveTextContent(/buscando lugares/i)

    await resolveSearch(requests[0], suggestionsResponse([]))
    expect(screen.getByRole('status')).toHaveTextContent(/no se encontraron/i)

    fireEvent.change(input, { target: { value: 'Seoud' } })
    await act(async () => { advance(400) })
    await resolveSearch(requests[1], new Response(null, { status: 429 }))
    expect(screen.getByRole('alert')).toHaveTextContent(/saturada/i)
  })

  it('offers manual retry against the same query after a provider failure', async () => {
    const fetchMock = vi.fn((...args: [RequestInfo | URL, RequestInit?]): Promise<Response> => {
      void args
      return Promise.resolve(new Response(null, { status: 200 }))
    })
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(suggestionsResponse([seoulSuggestion]))
    vi.stubGlobal('fetch', fetchMock)

    render(<LocationPicker onChange={() => {}} />)
    const input = screen.getByLabelText(/search/i)

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    await act(async () => { await fetchMock.mock.results[0].value })
    expect(screen.getByRole('alert')).toHaveTextContent(/not available/i)

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const passedInit = fetchMock.mock.calls[1][1]!
    expect(JSON.parse(passedInit.body as string).query).toBe('Seoul')
    await act(async () => { await fetchMock.mock.results[1].value })
    expect(screen.getByRole('option', { name: 'Seoul, South Korea' })).toBeTruthy()
  })

  it('emits an approximate selection carrying only the opaque token, never the address', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    stubFetch(requests)
    const onChange = vi.fn()

    render(<LocationPicker lang="es" onChange={onChange} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'La casa de Seúl' } })
    await act(async () => { advance(400) })
    await resolveSearch(requests[0], suggestionsResponse([seoulSuggestion]))

    fireEvent.click(screen.getByRole('option', { name: 'Seoul, South Korea' }))

    expect(onChange).toHaveBeenLastCalledWith({
      selectionId: 'opaque-selection-1',
      precision: 'approximate',
    })
    const emitted = onChange.mock.calls.at(-1)?.[0] as LocationPickerSelection
    expect(JSON.stringify(emitted)).not.toMatch(/casa|Seúl|Seoul|South Korea/i)
  })

  it('invalidates the selection when the query changes after selecting', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    stubFetch(requests)
    const onChange = vi.fn()

    render(<LocationPicker lang="es" onChange={onChange} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    await resolveSearch(requests[0], suggestionsResponse([seoulSuggestion]))

    fireEvent.click(screen.getByRole('option', { name: 'Seoul, South Korea' }))
    expect(onChange).toHaveBeenLastCalledWith({ selectionId: 'opaque-selection-1', precision: 'approximate' })

    fireEvent.change(input, { target: { value: 'Seoul zone' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.queryByLabelText(/lugar seleccionado/i)).toBeNull()
  })

  it('emits precisely only after confirming the public-point warning', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    stubFetch(requests)
    const onChange = vi.fn()

    render(<LocationPicker lang="es" onChange={onChange} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    await resolveSearch(requests[0], suggestionsResponse([seoulSuggestion]))

    fireEvent.click(screen.getByRole('option', { name: 'Seoul, South Korea' }))
    expect(onChange).toHaveBeenLastCalledWith({ selectionId: 'opaque-selection-1', precision: 'approximate' })

    fireEvent.click(screen.getByLabelText(/ubicación exacta/i))
    expect(onChange).toHaveBeenLastCalledWith(null)

    await act(async () => {})
    expect(leafletCallbacks.handlers.has('dragend')).toBe(true)

    await act(async () => {
      leafletCallbacks.handlers.get('dragend')?.()
    })
    expect(screen.getByText(/40\.51000, -3\.72000/)).toBeVisible()
    expect(onChange).toHaveBeenLastCalledWith(null)

    fireEvent.click(screen.getByRole('button', { name: /lo entiendo/i }))
    expect(onChange).toHaveBeenLastCalledWith({
      selectionId: 'opaque-selection-1',
      precision: 'precise',
      confirmedPublicPoint: { latitude: 40.51, longitude: -3.72 },
      preciseLocationConfirmed: true,
    })
  })

  it('lets the author change the place, clearing the emitted selection', async () => {
    const requests: Array<ReturnType<typeof deferred<Response>>> = []
    stubFetch(requests)
    const onChange = vi.fn()

    render(<LocationPicker lang="es" onChange={onChange} />)
    const input = screen.getByLabelText(/busca/i)

    fireEvent.change(input, { target: { value: 'Seoul' } })
    await act(async () => { advance(400) })
    await resolveSearch(requests[0], suggestionsResponse([seoulSuggestion]))

    fireEvent.click(screen.getByRole('option', { name: 'Seoul, South Korea' }))
    fireEvent.click(screen.getByRole('button', { name: /cambiar lugar/i }))

    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.queryByLabelText(/lugar seleccionado/i)).toBeNull()
  })
})