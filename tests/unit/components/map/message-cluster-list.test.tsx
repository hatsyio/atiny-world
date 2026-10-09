/** @vitest-environment jsdom */
import { act } from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { MessageClusterList } from '@/components/map/message-cluster-list'

const clients: QueryClient[] = []
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.unstubAllGlobals() })
function view(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const element = (requestUrl: string) => <QueryClientProvider client={client}><MessageClusterList requestUrl={requestUrl} onSelect={() => {}} /></QueryClientProvider>
  return { ...render(element(url)), element, client }
}
function response(content: string, nextCursor: string | null = null) {
  return new Response(JSON.stringify({ items: [{ publicId: content, content, locality: 'Seoul', country: 'Korea', author: { displayName: 'ATINY' } }], nextCursor }))
}
it('clears pages when the viewport changes and cancels a pending next page', async () => {
  let nextSignal: AbortSignal | undefined
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('cursor=')) { nextSignal = init?.signal as AbortSignal; return new Promise<Response>(() => {}) }
    return Promise.resolve(response(url.includes('city=B') ? 'new viewport' : 'old viewport', url.includes('city=B') ? null : 'next'))
  }))
  const result = view('/api/map/messages?city=A')
  await screen.findByText('old viewport')
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }))
  await waitFor(() => expect(nextSignal).toBeDefined())
  result.rerender(result.element('/api/map/messages?city=B'))
  await screen.findByText('new viewport')
  expect(screen.queryByText('old viewport')).toBeNull()
  expect(nextSignal?.aborted).toBe(true)
})
it('revalidates visible pages after invalidation and removes moderated content on failure', async () => {
  let hidden = false
  vi.stubGlobal('fetch', vi.fn(async () => hidden ? new Response(null, { status: 404 }) : response('visible letter')))
  const { client } = view('/api/map/messages?city=A')
  await screen.findByText('visible letter')
  hidden = true
  await act(async () => { await client.invalidateQueries() })
  await screen.findByRole('status')
  expect(screen.queryByText('visible letter')).toBeNull()
})
it('appends cursor pages and retries a failed next page without discarding read letters', async () => {
  let rejected = true
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!url.includes('cursor=')) return response('first letter', 'next')
    if (rejected) return new Response(null, { status: 400 })
    return response('second letter')
  }))
  view('/api/map/messages?city=A')
  await screen.findByText('first letter')
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }))
  await screen.findByRole('status')
  expect(screen.getByText('first letter')).toBeVisible()
  rejected = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('second letter')
  expect(screen.getByText('first letter')).toBeVisible()
})

it('restarts pagination when a previous deployment cursor is rejected without duplicating letters', async () => {
  let reset = false
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('cursor=')) return new Response(JSON.stringify({ code: 'VALIDATION_ERROR', fieldErrors: { cursor: 'pagination.cursorInvalid' } }), { status: 400 })
    return response(reset ? 'refreshed letter' : 'old page', reset ? null : 'previous-format-cursor')
  }))
  view('/api/map/messages?city=A')
  await screen.findByText('old page')
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }))
  await screen.findByRole('status')
  reset = true
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('refreshed letter')
  expect(screen.queryByText('old page')).toBeNull()
})

it('keeps the focused panel row through a pending viewport resize when filters stay the same', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('west=2')
    ? new Promise<Response>(done => { resolve = done })
    : Promise.resolve(response('same letter'))))
  const element = (west: number) => <MessageClusterList keepPreviousViewport requestUrl={`/api/map/messages?west=${west}&city=Madrid`} onSelect={() => {}} />
  const page = render(element(1))
  const row = await screen.findByRole('button', { name: /same letter/ })
  row.focus()
  page.rerender(element(2))
  expect(screen.getByRole('button', { name: /same letter/ })).toHaveFocus()
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument()
  expect(row.closest('.cluster-list-wrap')).toHaveAttribute('aria-busy', 'true')
  await act(async () => { resolve(response('same letter')) })
  expect(screen.getByRole('button', { name: /same letter/ })).toHaveFocus()
})
