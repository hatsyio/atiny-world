/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { render } from '../../../support/intl'
import { LettersArchive } from '@/components/messages/letters-archive'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
afterEach(cleanup)
const letter = {
  publicId: 'letter-one', content: 'Love across the seas',
  point: { latitude: 40.4, longitude: -3.7 }, precision: 'approximate' as const,
  locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-10-01T10:00:00Z', author: { publicId: 'author-one', displayName: 'ATINY' },
}
it('preserves criteria and page in detail and pagination links, but resets page on search', () => {
  const { container } = render(<LettersArchive criteria={{ q: 'love', city: 'Madrid', country: 'es', page: 2 }} countries={['es']} page={{ items: [letter], page: 2, totalPages: 3 }} />)
  expect(screen.getByText(letter.content)).toBeVisible()
  const detail = new URL(screen.getByRole('link', { name: 'Read letter by ATINY' }).getAttribute('href')!, 'https://local.test')
  expect(detail.searchParams.get('returnTo')).toBe('/letters?q=love&country=es&city=Madrid&page=2#letter-letter-one')
  expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/letters?q=love&country=es&city=Madrid&page=3')
  expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/letters?q=love&country=es&city=Madrid')
  expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  expect(container.querySelector('[name="page"]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeEnabled()
  expect(screen.getByRole('searchbox', { name: 'Search letter text' })).toHaveValue('love')
})
it('offers an empty result recovery translated into Spanish', () => {
  render(<LettersArchive criteria={{ q: 'no matches' }} countries={[]} page={{ items: [], page: 1, totalPages: 0 }} />, { locale: 'es' })
  expect(screen.getByRole('status')).toHaveTextContent('No hay cartas que coincidan')
  expect(screen.getByRole('button', { name: 'Limpiar búsqueda y filtros' })).toBeEnabled()
})

it('shows flags alongside locations and country options', async () => {
  render(<LettersArchive criteria={{}} countries={['es', 'kr']} page={{ items: [letter], page: 1, totalPages: 1 }} />)
  expect(screen.getByText('🇪🇸')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('Madrid, Spain')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Country/ }))
  expect(await screen.findByRole('option', { name: '🇰🇷 South Korea' })).toBeVisible()
  fireEvent.click(screen.getByRole('option', { name: '🇪🇸 Spain' }))
  expect(screen.getByRole('button', { name: /🇪🇸 Spain/ })).toBeVisible()
})
it('keeps a long page range compact and allows jumping to the last page', () => {
  const { container } = render(<LettersArchive criteria={{ page: 5 }} countries={[]} page={{ items: [letter], page: 5, totalPages: 100 }} />)
  expect(screen.getByRole('link', { name: 'Page 100' })).toHaveAttribute('href', '/letters?page=100')
  expect(container.querySelectorAll('.letters-archive__pagination a').length).toBeLessThanOrEqual(9)
})
