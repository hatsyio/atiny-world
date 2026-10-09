/** @vitest-environment jsdom */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'
const replace = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
import { AdminSearchForm } from '@/components/admin/admin-search-form'
import { AdminLoading } from '@/components/admin/admin-loading'

afterEach(() => { cleanup(); replace.mockReset() })
it('preserves search fields and shows progress until the navigation completes', async () => {
  let complete!: () => void
  replace.mockImplementation(() => new Promise<void>(resolve => { complete = resolve }))
  const { container } = render(<AdminSearchForm action="/admin/messages" className="admin-search" values={{ q: 'Madrid & Seoul', status: 'pending' }}><input name="q" defaultValue="Madrid & Seoul" /><input name="status" defaultValue="pending" /><button type="submit">Search</button></AdminSearchForm>)
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Loading administration'))
  expect(replace).toHaveBeenCalledWith('/admin/messages?q=Madrid+%26+Seoul&status=pending', { scroll: false })
  expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled()
  await act(async () => complete())
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'false')
})
it('announces loading in Spanish without announcing the decorative spinner', () => {
  const { container } = render(<AdminLoading />, { locale: 'es' })
  expect(screen.getByRole('status')).toHaveTextContent('Cargando administración')
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
