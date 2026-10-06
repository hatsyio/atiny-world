/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, IntlTestProvider } from '../../../support/intl'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/app/(site)/my-messages/delete-action', () => ({ deleteMessageAction: vi.fn() }))
import { MyMessageList } from '@/components/messages/my-message-list'

afterEach(cleanup)
it.each([
  ['en', 'privacy', 'Personal data or private information'],
  ['es', 'privacy', 'Datos personales o información privada'],
  ['en', 'community_guidelines', 'Community guidelines violation'],
  ['es', 'community_guidelines', 'Incumplimiento de las normas de la comunidad'],
] as const)('translates %s reason %s for the author', (locale, reason, label) => {
  render(<IntlTestProvider locale={locale}><MyMessageList messages={[{ publicId: '123e4567-e89b-42d3-a456-426614174000', version: 2, status: 'rejected', moderationReasonCode: reason, moderationNote: 'A private note', content: 'My letter', publicVisible: false }]} /></IntlTestProvider>)
  expect(screen.getByText(label)).toBeVisible()
  expect(screen.getByText('A private note')).toBeVisible()
})
it('uses a safe label instead of displaying an unknown stored reason code', () => {
  render(<MyMessageList messages={[{ publicId: '123e4567-e89b-42d3-a456-426614174000', version: 2, status: 'withdrawn', moderationReasonCode: 'internal_private_code', moderationNote: null, content: 'My letter', publicVisible: false }]} />)
  expect(screen.getByText('Moderation reason')).toBeVisible()
  expect(screen.queryByText('internal_private_code')).not.toBeInTheDocument()
})
