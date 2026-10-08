/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { render } from '../../support/intl'
import { AdminSelect } from '@/components/admin/admin-select'

const options = [{ value: 'spam', label: 'Spam' }, { value: 'privacy', label: 'Personal information' }]
afterEach(cleanup)

it('opens app options and submits the selected reason under its field name', async () => {
  const { container } = render(<form><AdminSelect label="Reason" name="reasonCode" options={options} placeholder="Choose a reason" required /></form>)
  expect(container.querySelector('form')!.checkValidity()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: /Reason/ }))
  fireEvent.click(await screen.findByRole('option', { name: 'Personal information' }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(new FormData(container.querySelector('form')!).get('reasonCode')).toBe('privacy')
  expect(container.querySelector('form')!.checkValidity()).toBe(true)
})

it('supports keyboard selection and Escape without submitting the form', async () => {
  const { container } = render(<form><AdminSelect label="Reason" name="reasonCode" options={options} defaultValue="spam" /></form>)
  const trigger = screen.getByRole('button', { name: /Reason/ })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  await screen.findByRole('listbox')
  await waitFor(() => expect(screen.getByRole('option', { name: 'Spam' })).toHaveFocus())
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  await waitFor(() => expect(screen.getByRole('option', { name: 'Personal information' })).toHaveFocus())
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  fireEvent.keyUp(document.activeElement!, { key: 'Enter' })
  expect(new FormData(container.querySelector('form')!).get('reasonCode')).toBe('privacy')
  fireEvent.click(trigger)
  fireEvent.keyDown(await screen.findByRole('listbox'), { key: 'Escape' })
  expect(screen.queryByRole('listbox')).toBeNull()
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('prevents opening or submitting disabled fields', () => {
  const { container } = render(<form><AdminSelect label="Reason" name="reasonCode" options={options} defaultValue="spam" disabled /></form>)
  const trigger = screen.getByRole('button', { name: /Reason/ })
  expect(trigger).toBeDisabled()
  fireEvent.click(trigger)
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(new FormData(container.querySelector('form')!).has('reasonCode')).toBe(false)
})
