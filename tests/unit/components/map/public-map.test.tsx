/** @vitest-environment jsdom */

import { cleanup,  screen, waitFor, within } from '@testing-library/react'
import { render } from '../../../support/intl'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageClusterList } from '../../../../src/components/map/message-cluster-list'
import { LeafletMap } from '../../../../src/components/map/leaflet-map'
import { MapFilters, type MapFilterValues } from '../../../../src/components/map/map-filters'
import { PublicMapLoader } from '../../../../src/components/map/public-map-loader'
import { PublicMessageCard } from '../../../../src/components/messages/public-message-card'
import type { MapFeature } from '../../../../src/server/messages/public-repository'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const baseFeature: MapFeature = {
  publicId: '11111111-1111-4111-8111-111111111111',
  point: { latitude: 40.4167, longitude: -3.7033 },
  precision: 'approximate',
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  publishedAt: '2026-09-15T10:00:00.000Z',
  author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'ATINY' },
}

describe('MessageClusterList', () => {
  it('loads message content and keeps the author secondary', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ ...baseFeature, content: 'Gracias por vuestra música' }],
      nextCursor: null,
    }))))
    render(<MessageClusterList requestUrl="/api/map/messages?limit=20" onSelect={() => {}} />, { locale: 'es' })

    expect(screen.queryByText('ATINY')).toBeNull()
    expect(await screen.findByText('Gracias por vuestra música')).toBeInTheDocument()
    expect(screen.getByText(/Madrid, España · ATINY/)).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('notifies selection of a message', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ ...baseFeature, content: 'A letter for ATEEZ' }],
      nextCursor: null,
    }))))
    render(<MessageClusterList requestUrl="/api/map/messages?limit=20" onSelect={onSelect} />, { locale: 'en' })

    await user.click(await screen.findByRole('button', { name: /A letter for ATEEZ/ }))
    expect(onSelect).toHaveBeenCalledWith(baseFeature.publicId)
  })

  it('shows a retry action when the messages cannot be loaded', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], nextCursor: null })))
    vi.stubGlobal('fetch', fetch)
    render(<MessageClusterList requestUrl="/api/map/messages?limit=20" onSelect={() => {}} />, { locale: 'es' })

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })
})

describe('MapFilters', () => {
  const defaults: MapFilterValues = {
    city: '',
    country: '',
  }

  it('does not show a recipient filter', () => {
    render(<MapFilters value={defaults} onChange={() => {}} />)

    expect(screen.queryByRole('combobox', { name: /destinatario/i })).not.toBeInTheDocument()
  })

  it('exposes accessible city and country filters without an author filter', () => {
    render(<MapFilters value={defaults} onChange={() => {}} />)

    expect(screen.getByRole('textbox', { name: /city/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /country/i })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /fan|autor|usuario/i })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /filters/i })).toBeTruthy()
  })

  it('changes country and clears it without losing the city filter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<MapFilters value={{ city: 'Seoul', country: 'kr' }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /Country/ }))
    // Scope text lookup to the accessible open list instead of computing 250 option names.
    const countries = within(await screen.findByRole('listbox'))
    await user.click(countries.getByText('ES'))
    expect(onChange).toHaveBeenLastCalledWith({ city: 'Seoul', country: 'es' })
    rerender(<MapFilters value={{ city: 'Seoul', country: 'es' }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /Country/ }))
    const updatedCountries = within(await screen.findByRole('listbox'))
    await user.click(updatedCountries.getByText('All'))
    expect(onChange).toHaveBeenLastCalledWith({ city: 'Seoul', country: '' })
  })

})

describe('PublicMapLoader', () => {
  it('announces that the client-only Leaflet map is loading', () => {
    render(<PublicMapLoader features={[]} onSelect={() => {}} />)

    expect(screen.getByRole('status').textContent).toMatch(/loading map/i)
  })

  it('offers the group control without an external fullscreen button', () => {
    process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY = 'test-key'
    render(
      <LeafletMap
        features={[baseFeature, { ...baseFeature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }]}
        onSelect={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /view \d+ messages/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).toBeNull()
  })
})

describe('PublicMessageCard', () => {
  it('shows only public message fields', () => {
    render(
      <PublicMessageCard
        message={{
          ...baseFeature,
          content: 'Gracias por estar aquí',
        }}
      />,
    )

    expect(screen.getByText('Gracias por estar aquí')).toBeTruthy()
    expect(screen.getByText('ATINY')).toBeTruthy()
    expect(screen.getByText(/Madrid, España/)).toBeTruthy()
  })

  it('shows a non-disclosing unavailable state', () => {
    render(<PublicMessageCard message={null} />)

    expect(screen.getByRole('status').textContent).toMatch(/not available/i)
    expect(screen.queryByText(/pendiente|rechazado|oculto/i)).toBeNull()
  })
})
