/** @vitest-environment jsdom */
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { render, IntlTestProvider } from '../../support/intl'
const runtimeDate = vi.hoisted(() => ({ text: 'Oct 6, 2026, 10:00 AM' }))
vi.mock('next-intl', async (importOriginal) => ({
  ...await importOriginal<typeof import('next-intl')>(),
  useFormatter: () => ({ dateTime: () => runtimeDate.text }),
}))
vi.mock('@/app/(site)/admin/messages/actions', () => ({ moderateMessageAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { MessageQueue, type ModerationQueueMessage } from '@/components/admin/message-queue'
import { moderateMessageAction } from '@/app/(site)/admin/messages/actions'

const message: ModerationQueueMessage = { publishedAtLabel: 'Oct 6, 2026, 10:00 AM', publicId: '123e4567-e89b-42d3-a456-426614174000', version: 1, status: 'pending', content: 'Letter to review', authorName: 'ATINY', authorState: 'active', locality: 'Seoul', country: 'South Korea', publishedAt: '2026-10-06T10:00:00.000Z', reasonCode: null, note: null, publicVisible: true, decisions: ['approve', 'reject', 'withdraw'] }
afterEach(() => { cleanup(); vi.resetAllMocks(); runtimeDate.text = 'Oct 6, 2026, 10:00 AM' })
it('hydrates the server date unchanged when the browser Intl format differs', async () => {
  const stableMessage = { ...message, decisions: [], publishedAtLabel: runtimeDate.text }
  const content = <IntlTestProvider><MessageQueue messages={[stableMessage]} /></IntlTestProvider>
  const container = document.createElement('div')
  document.body.append(container)
  container.innerHTML = renderToString(content)
  // Actual Node/V8 and JavaScriptCore output for the same en + UTC date.
  runtimeDate.text = 'Oct 6, 2026 at 10:00 AM'
  const onRecoverableError = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => { root = hydrateRoot(container, content, { onRecoverableError }) })
    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.querySelector('time')).toHaveTextContent('Oct 6, 2026, 10:00 AM UTC')
    expect(container.querySelector('time')).toHaveAttribute('dateTime', message.publishedAt)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
it('shows text for review and only allowed decisions, without an edit control', () => {
  render(<MessageQueue messages={[message]} />)
  expect(screen.getByText('Letter to review')).toBeVisible()
  expect(screen.getByText('ATINY')).toBeVisible()
  expect(screen.getByRole('option', { name: 'Withdraw' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /content|letter/i })).not.toBeInTheDocument()
})
it('requires a reason for rejection and withdrawal, and submits the exact reviewed version', async () => {
  vi.mocked(moderateMessageAction).mockResolvedValue({ status: 'saved' })
  render(<MessageQueue messages={[message]} />)
  expect(screen.queryByRole('combobox', { name: 'Reason' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox', { name: 'Decision' }), { target: { value: 'reject' } })
  expect(screen.getByRole('combobox', { name: 'Reason' })).toBeRequired()
  fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), { target: { value: 'privacy' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Private note (optional, shared with the author)' }), { target: { value: 'Private note' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Decision saved.'))
  const data = vi.mocked(moderateMessageAction).mock.calls[0][1]
  expect(data.get('publicId')).toBe(message.publicId)
  expect(data.get('expectedVersion')).toBe('1')
  expect(data.get('decision')).toBe('reject')
  expect(data.get('reasonCode')).toBe('privacy')
})
it('shows a conflict, disables resubmission and offers an explicit reload', async () => {
  vi.mocked(moderateMessageAction).mockResolvedValue({ status: 'conflict' })
  render(<MessageQueue messages={[message]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This letter has changed. Reload and review the current version.'))
  expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reload letters' })).toBeVisible()
})
it('keeps success feedback after the moderated letter leaves the pending queue', async () => {
  vi.mocked(moderateMessageAction).mockResolvedValue({ status: 'saved' })
  const { rerender } = render(<MessageQueue messages={[message]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Decision saved.'))
  rerender(<MessageQueue messages={[]} />)
  expect(screen.getByText('Decision saved.')).toBeVisible()
})
it('allows a fresh decision after reloading changed visibility without a content version change', async () => {
  vi.mocked(moderateMessageAction).mockResolvedValue({ status: 'transition' })
  const { rerender } = render(<MessageQueue messages={[message]} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Decision' }), { target: { value: 'withdraw' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Reason' }), { target: { value: 'spam' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply decision' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This decision is no longer available.'))
  expect(screen.getByRole('button', { name: 'Apply decision' })).toBeDisabled()
  rerender(<MessageQueue messages={[{ ...message, publicVisible: false, decisions: ['approve', 'reject'] }]} />)
  expect(screen.getByRole('button', { name: 'Apply decision' })).toBeEnabled()
  expect(screen.queryByRole('option', { name: 'Withdraw' })).not.toBeInTheDocument()
})
it('shows translated current reasons and offers no controls for final states', () => {
  render(<IntlTestProvider locale="es"><MessageQueue messages={[{ ...message, status: 'withdrawn', reasonCode: 'privacy', note: 'Nota privada', decisions: [], publicVisible: false }]} /></IntlTestProvider>)
  expect(screen.getByText('Datos personales o información privada')).toBeVisible()
  expect(screen.getByText('Nota privada')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Aplicar decisión' })).not.toBeInTheDocument()
})
