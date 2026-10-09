/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { render } from '../../../support/intl'
import { LettersArchive } from '@/components/messages/letters-archive'

vi.mock('next/form', () => ({ default: 'form' }))
afterEach(cleanup)
const letter = {
  publicId: 'letter-one', content: 'Love across the seas',
  point: { latitude: 40.4, longitude: -3.7 }, precision: 'approximate' as const,
  locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-10-01T10:00:00Z', author: { publicId: 'author-one', displayName: 'ATINY' },
}
it('preserves criteria and page in detail and pagination links, but resets page on search', () => {
  const { container } = render(<LettersArchive criteria={{ q: 'love', city: 'Madrid', country: 'es', cursor: 'current' }} countries={['es']} page={{ items: [letter], nextCursor: 'older' }} />)
  expect(screen.getByText(letter.content)).toBeVisible()
  const detail = new URL(screen.getByRole('link', { name: 'Read letter by ATINY' }).getAttribute('href')!, 'https://local.test')
  expect(detail.searchParams.get('returnTo')).toBe('/letters?q=love&country=es&city=Madrid&cursor=current#letter-letter-one')
  expect(screen.getByRole('link', { name: 'Older letters' })).toHaveAttribute('href', '/letters?q=love&country=es&city=Madrid&cursor=older')
  expect(container.querySelector('[name="cursor"]')).toBeNull()
  expect(screen.getByRole('link', { name: 'Clear search and filters' })).toHaveAttribute('href', '/letters')
  expect(screen.getByRole('searchbox', { name: 'Search letter text' })).toHaveValue('love')
})
it('offers an empty result recovery translated into Spanish', () => {
  render(<LettersArchive criteria={{ q: 'no matches' }} countries={[]} page={{ items: [], nextCursor: null }} />, { locale: 'es' })
  expect(screen.getByRole('status')).toHaveTextContent('No hay cartas que coincidan')
  expect(screen.getByRole('link', { name: 'Limpiar búsqueda y filtros' })).toHaveAttribute('href', '/letters')
})
