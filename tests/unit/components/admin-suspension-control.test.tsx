/** @vitest-environment jsdom */
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, IntlTestProvider } from '../../support/intl'
vi.mock('@/app/(site)/admin/users/actions', () => ({ setSuspensionAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { SuspensionControl } from '@/components/admin/suspension-control'
import { setSuspensionAction } from '@/app/(site)/admin/users/actions'
const account = { publicId: 'target', displayName: 'ATINY', role: 'fan' as const, roleVersion: 1, suspensionVersion: 1, state: 'active' as const }
afterEach(() => { cleanup(); vi.resetAllMocks() })
it('requires confirmation and a known reason; reactivation offers no reason and clears prior confirmation', () => {
  const { rerender } = render(<SuspensionControl account={account} />)
  expect(document.querySelector('select[name="reasonCode"]')).toBeRequired()
  const checkbox = screen.getByRole('checkbox', { name: 'Confirm suspending ATINY and hiding their letters.' })
  expect(checkbox).toBeRequired()
  fireEvent.click(checkbox)
  rerender(<SuspensionControl account={{ ...account, state: 'suspended', suspensionVersion: 2 }} />)
  expect(screen.queryByRole('button', { name: /Reason/ })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Confirm reactivating ATINY under the current visibility rules.' })).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Reactivate account' })).toBeVisible()
})
it('shows conflicts with reload and disables stale submission', async () => {
  vi.mocked(setSuspensionAction).mockResolvedValue({ status: 'conflict' })
  render(<SuspensionControl account={account} />)
  fireEvent.click(screen.getByRole('button', { name: /Reason/ }))
  fireEvent.click(await screen.findByRole('option', { name: 'Spam or unsolicited content' }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Suspend account' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This account changed. Reload before trying again.'))
  expect(screen.getByRole('button', { name: 'Suspend account' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reload accounts' })).toBeVisible()
})
it('provides Spanish labels and limits private notes', () => {
  render(<IntlTestProvider locale="es"><SuspensionControl account={account} /></IntlTestProvider>)
  expect(screen.getByRole('button', { name: 'Suspender cuenta' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Nota privada para administración (opcional)' })).toHaveAttribute('maxlength', '1000')
})
