/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, IntlTestProvider } from '../../support/intl'

vi.mock('@/app/(site)/admin/settings/actions', () => ({ updateSettingsAction: vi.fn() }))

import { AdminSettingsControl } from '@/components/admin/settings-control'
import { updateSettingsAction } from '@/app/(site)/admin/settings/actions'

const settings = { premoderationEnabled: false, messageLimit: 10, cooldownSeconds: 10, version: 4, pendingActiveMessages: 3 }

afterEach(() => { cleanup(); vi.resetAllMocks() })

it('requires an impact confirmation before enabling premoderation', () => {
  render(<AdminSettingsControl settings={settings} />)
  const moderation = screen.getByRole('checkbox', { name: 'Require approval before a letter appears publicly' })
  fireEvent.click(moderation)
  expect(screen.getByText('3 pending letters will be hidden.')).toBeVisible()
  const confirm = screen.getByRole('checkbox', { name: 'Confirm hiding 3 pending letters.' })
  expect(confirm).toBeRequired()
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  fireEvent.click(confirm)
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled()
})

it('resets the confirmation when the selected moderation mode changes', () => {
  render(<AdminSettingsControl settings={{ ...settings, premoderationEnabled: true }} />)
  const moderation = screen.getByRole('checkbox', { name: 'Require approval before a letter appears publicly' })
  fireEvent.click(moderation)
  const confirm = screen.getByRole('checkbox', { name: 'Confirm showing 3 pending letters.' })
  fireEvent.click(confirm)
  fireEvent.click(moderation)
  expect(screen.queryByRole('checkbox', { name: 'Confirm showing 3 pending letters.' })).toBeNull()
})

it('shows a stale impact response without an automatic retry', async () => {
  vi.mocked(updateSettingsAction).mockResolvedValue({ status: 'conflict' })
  render(<AdminSettingsControl settings={settings} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Require approval before a letter appears publicly' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Confirm hiding 3 pending letters.' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The settings or their impact changed. Reload before trying again.'))
})

it('provides Spanish impact confirmation text', () => {
  render(<IntlTestProvider locale="es"><AdminSettingsControl settings={settings} /></IntlTestProvider>)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Exigir aprobación antes de que una carta aparezca públicamente' }))
  expect(screen.getByRole('checkbox', { name: 'Confirmo ocultar 3 cartas pendientes.' })).toBeRequired()
})
