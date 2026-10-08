/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../support/intl'
import { AdminNavigation } from '@/components/admin/admin-navigation'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))
import { usePathname } from 'next/navigation'

afterEach(() => { cleanup(); vi.resetAllMocks() })

it.each([
  ['/admin/messages', 'Moderación de mensajes'],
  ['/admin/users', 'Usuarios y roles'],
  ['/admin/settings', 'Configuración operativa'],
] as const)('identifies the current section at %s', (path, label) => {
  vi.mocked(usePathname).mockReturnValue(path)
  const { rerender } = render(<AdminNavigation />, { locale: 'es' })
  expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1)
  vi.mocked(usePathname).mockReturnValue('/admin/settings')
  rerender(<AdminNavigation />)
  expect(screen.getByRole('link', { name: 'Configuración operativa' })).toHaveAttribute('aria-current', 'page')
})
