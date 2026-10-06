/** @vitest-environment jsdom */
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, IntlTestProvider } from '../../support/intl'
vi.mock('@/app/(site)/admin/users/actions', () => ({ setAdministratorRoleAction: vi.fn(), setSuspensionAction: vi.fn() }))
import { RoleControl } from '@/components/admin/role-control'
import { setAdministratorRoleAction } from '@/app/(site)/admin/users/actions'

const account = { publicId: 'target', displayName: 'ATINY', role: 'fan' as const, roleVersion: 1, suspensionVersion: 1, state: 'active' as const }
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('requires confirmation naming the target and resets it when the next role changes', () => {
  const { rerender } = render(<RoleControl account={account} />)
  const confirm = screen.getByRole('checkbox', { name: 'Confirm changing ATINY to Administrator.' })
  expect(confirm).toBeRequired()
  fireEvent.click(confirm)
  expect(confirm).toBeChecked()
  rerender(<RoleControl account={{ ...account, role: 'admin' }} />)
  expect(screen.getByRole('checkbox', { name: 'Confirm changing ATINY to Fan.' })).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Remove administrator role' })).toBeVisible()
})
it('shows a stale role response and offers no silent retry', async () => {
  vi.mocked(setAdministratorRoleAction).mockResolvedValue({ status: 'conflict' })
  render(<RoleControl account={account} />)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Make administrator' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This role has changed. Reload the page before trying again.'))
})
it('provides Spanish labels for role changes', () => {
  render(<IntlTestProvider locale="es"><RoleControl account={account} /></IntlTestProvider>)
  expect(screen.getByRole('button', { name: 'Asignar administrador' })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Confirmo cambiar a ATINY al rol de Administrador.' })).toBeRequired()
})
