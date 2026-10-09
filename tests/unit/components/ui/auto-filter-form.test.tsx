/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { AutoFilterForm, AutoFilterInput } from '@/components/ui/auto-filter-form'
import { AppSelect } from '@/components/ui/app-select'

const navigation = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
afterEach(() => { cleanup(); navigation.replace.mockReset(); window.history.replaceState(null, '', '/') })

function Filters({ q = '', country = '' }) {
  return <AutoFilterForm action="/letters" values={{ q, country }} className="filters" clearLabel="Clear" loadingLabel="Loading">
    <label>Search<AutoFilterInput name="q" type="search" /></label>
    <AppSelect name="country" label="Country" options={[{ value: '', label: 'All' }, { value: 'es', label: 'Spain' }]} />
  </AutoFilterForm>
}

it('debounces text, applies a select immediately and keeps newer typing through a stale response', async () => {
  const view = render(<Filters />)
  const input = screen.getByRole('searchbox', { name: 'Search' })
  input.focus()
  fireEvent.change(input, { target: { value: 'M' } })
  fireEvent.change(input, { target: { value: 'Mad' } })
  expect(navigation.replace).not.toHaveBeenCalled()
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/letters?q=Mad', { scroll: false }))
  fireEvent.change(input, { target: { value: 'Madrid' } })
  view.rerender(<Filters q="Mad" />)
  expect(input).toHaveValue('Madrid')
  expect(input).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /Country/ }))
  fireEvent.click(await screen.findByRole('option', { name: 'Spain' }))
  expect(navigation.replace).toHaveBeenLastCalledWith('/letters?q=Madrid&country=es', { scroll: false })
})

it('keeps clear mounted, cancels pending typing and resets every field', async () => {
  render(<Filters />)
  const clear = screen.getByRole('button', { name: 'Clear' })
  expect(clear).toBeDisabled()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Mad' } })
  expect(screen.getByRole('button', { name: 'Clear' })).toBe(clear)
  fireEvent.click(clear)
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(clear).toBeDisabled()
  expect(navigation.replace).toHaveBeenLastCalledWith('/letters', { scroll: false })
  await new Promise(resolve => setTimeout(resolve, 400))
  expect(navigation.replace).toHaveBeenCalledTimes(1)
})

it('restores filter fields after external navigation and browser Back', () => {
  const view = render(<Filters q="Mad" country="es" />)
  view.rerender(<Filters q="Seoul" />)
  expect(screen.getByRole('searchbox')).toHaveValue('Seoul')
  window.history.replaceState(null, '', '/letters?q=Mad&country=es&page=2')
  fireEvent(window, new PopStateEvent('popstate'))
  expect(screen.getByRole('searchbox')).toHaveValue('Mad')
  expect(screen.getByRole('button', { name: /Country/ })).toHaveTextContent('Spain')
})
