/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { LetterDetail } from '@/components/messages/letter-detail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/app/(site)/my-messages/actions', () => ({ updateMessageAction: vi.fn() }))
const message = {
  publicId: 'letter-1', version: 1, status: 'approved' as const,
  moderationReasonCode: null, moderationNote: null,
  content: 'My original letter', point: { latitude: 40.4, longitude: -3.7 },
  precision: 'approximate' as const, locality: 'Madrid', country: 'España', countryCode: 'es',
  publishedAt: '2026-09-29T10:00:00.000Z', author: { publicId: 'author-1', displayName: 'ATINY' },
}
afterEach(cleanup)
it('keeps another author’s letter read-only', () => {
  render(<LetterDetail message={message} />)
  expect(screen.getByText('My original letter')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit letter' })).toBeNull()
  expect(screen.queryByRole('textbox', { name: 'Your letter' })).toBeNull()
})
it('lets the owner edit and discard a draft in the detail', () => {
  render(<LetterDetail message={message} ownMessage={message} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit letter' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Your letter' }), { target: { value: 'Unsaved draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('textbox', { name: 'Your letter' })).toBeNull()
  expect(screen.getByText('My original letter')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Edit letter' }))
  expect(screen.getByRole('textbox', { name: 'Your letter' })).toHaveValue('My original letter')
})

it('renders URLs and HTML as literal letter text without executable markup', () => {
  const content = '사랑해요 ATINY\nVisita https://example.com <script>alert(1)</script><a href="https://example.com">link</a>'
  const { container } = render(<LetterDetail message={{ ...message, content }} />)
  expect(container.querySelector('.letter-reading__content')?.textContent).toBe(content)
  expect(container.querySelector('.letter-reading__content a')).toBeNull()
  expect(container.querySelector('.letter-reading__content script')).toBeNull()
})
