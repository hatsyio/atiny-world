/** @vitest-environment jsdom */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { render, IntlTestProvider } from '../../support/intl'
import { SuspensionNotice } from '@/components/account/suspension-notice'
afterEach(cleanup)
it.each(['en', 'es'] as const)('explains suspension and links to allowed letter controls in %s', locale => {
  render(<IntlTestProvider locale={locale}><SuspensionNotice reasonCode="privacy" /></IntlTestProvider>)
  expect(screen.getByRole('status')).toHaveTextContent(locale === 'es' ? 'Tu cuenta está suspendida' : 'Your account is suspended')
  expect(screen.getByRole('status')).toHaveTextContent(locale === 'es' ? 'Datos personales o información privada' : 'Personal data or private information')
  expect(screen.getByRole('link', { name: locale === 'es' ? 'Consultar o borrar mis cartas' : 'Read or delete my letters' })).toHaveAttribute('href', '/my-messages')
})
it('never exposes unknown private reason codes', () => {
  render(<SuspensionNotice reasonCode="legacy_private_reason" />)
  expect(screen.getByRole('status')).not.toHaveTextContent('legacy_private_reason')
})
