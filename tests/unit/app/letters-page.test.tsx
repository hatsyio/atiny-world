import { expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('@/server/messages/public-repository', () => ({
  pagePublicLetters: vi.fn(async () => ({ items: [], page: 2, totalPages: 2 })),
  listPublicLetterCountries: vi.fn(async () => ['es']),
}))
import LettersPage from '@/app/(site)/letters/page'
import { readLetterExploration } from '@/components/messages/letter-exploration'
import { pagePublicLetters } from '@/server/messages/public-repository'

it('loads a public archive with combined URL criteria and no account gate', async () => {
  const page = await LettersPage({ searchParams: Promise.resolve({ q: ' love ', country: 'ES', city: ' Madrid ', page: '2' }) })
  expect(page.props.criteria).toEqual({ q: 'love', country: 'es', city: 'Madrid', page: 2 })
  expect(pagePublicLetters).toHaveBeenCalledWith({}, page.props.criteria)
  expect(page.props.countries).toEqual(['es'])
})
it('bounds URL input and ignores repeated or malformed filters', () => {
  expect(readLetterExploration({ q: ['love', 'hate'], city: 'a'.repeat(200), country: 'esp', page: ['2', '3'] })).toEqual({
    q: '', country: '', city: 'a'.repeat(100), page: 1,
  })
})

it.each(['0', '-1', '1.5', '2e2', 'abc', '9007199254740992'])('resets invalid page %s to the first page', value => {
  expect(readLetterExploration({ page: value }).page).toBe(1)
})
