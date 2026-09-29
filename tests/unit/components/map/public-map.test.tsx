/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MessageClusterList } from '../../../../src/components/map/message-cluster-list'
import { LeafletMap } from '../../../../src/components/map/leaflet-map'
import { MapFilters, type MapFilterValues } from '../../../../src/components/map/map-filters'
import { PublicMapLoader } from '../../../../src/components/map/public-map-loader'
import { PublicMessageCard } from '../../../../src/components/messages/public-message-card'
import type { MapFeature } from '../../../../src/server/messages/public-repository'

afterEach(cleanup)

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
  it('renders one entry per public point', () => {
    render(
      <MessageClusterList
        items={[
          { ...baseFeature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' },
          { ...baseFeature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' },
        ]}
        onSelect={() => {}}
      />,
    )

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('does not render any text content or moderation state', () => {
    render(
      <MessageClusterList
        items={[baseFeature]}
        onSelect={() => {}}
      />,
    )

    expect(screen.queryByText(/hola/i)).toBeNull()
    expect(screen.queryByText(/rejected|pending|approved/i)).toBeNull()
  })

  it('notifies selection of a point', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(<MessageClusterList items={[baseFeature]} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /ATINY/ }))
    expect(onSelect).toHaveBeenCalledWith(baseFeature.publicId)
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

    expect(screen.getByRole('textbox', { name: /ciudad/i })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /país/i })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: /fan|autor|usuario/i })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: /filtros/i })).toBeTruthy()
  })

})

describe('PublicMapLoader', () => {
  it('announces that the client-only Leaflet map is loading', () => {
    render(<PublicMapLoader features={[]} onSelect={() => {}} />)

    expect(screen.getByRole('status').textContent).toMatch(/cargando mapa/i)
  })

  it('offers visible spiderfy and fullscreen controls for clustered points', () => {
    process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY = 'test-key'
    render(
      <LeafletMap
        features={[baseFeature, { ...baseFeature, publicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }]}
        onSelect={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /ver mensajes del grupo/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /pantalla completa/i })).toBeTruthy()
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

    expect(screen.getByRole('status').textContent).toMatch(/no está disponible/i)
    expect(screen.queryByText(/pendiente|rechazado|oculto/i)).toBeNull()
  })
})
