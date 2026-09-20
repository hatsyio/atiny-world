/** @vitest-environment jsdom */

import { cleanup } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RECIPIENTS } from '@/domain/contracts'
import { CreateMessageForm, type CreateMessageFormProps } from '@/components/messages/create-message-form'

afterEach(cleanup)

export function typeGraphemes(target: HTMLElement, count: number): string {
  return 'a'.repeat(count)
}

// La publicación usa el conteo de grafemas del dominio para que cada composición
// emoji cuente como una frente al límite de 500 (data-model.md: content "máximo
// 500 grafemas"; UI mantiene el mismo contador que el servidor).
describe('CreateMessageForm', () => {
  function renderForm(overrides: Partial<CreateMessageFormProps> = {}) {
    const props: CreateMessageFormProps = {
      recipient: null,
      onRecipientChange: () => {},
      submitState: { kind: 'idle' },
      onSubmit: () => Promise.resolve(undefined),
      ...overrides,
    }
    return render(<CreateMessageForm {...props} />)
  }

  it('muestra un contador de grafemas visible y lo actualiza mientras se escribe', async () => {
    const user = userEvent.setup()
    renderForm()
    const textarea = screen.getByLabelText(/message\.content/) as HTMLTextAreaElement
    await user.type(textarea, typeGraphemes(textarea, 120))
    expect(screen.getByText(/120\/500/)).toBeVisible()
  })

  it('permite completar el contenido hasta 500 grafemas y bloquea a 501', async () => {
    const user = userEvent.setup()
    renderForm()
    const textarea = screen.getByLabelText(/message\.content/) as HTMLTextAreaElement
    await user.type(textarea, typeGraphemes(textarea, 501))
    expect(screen.getByRole('button', { name: /message\.publish/ })).toBeDisabled()
    expect(screen.getByText(/message\.content\.limitReached/)).toBeVisible()

    await user.clear(textarea)
    await user.type(textarea, typeGraphemes(textarea, 500))
    expect(screen.getByRole('button', { name: /message\.publish/ })).toBeEnabled()
  })

  it('ofrece un selector de destinatario con la lista permitida y resiste valores no permitidos', () => {
    renderForm()
    const selector = screen.getByRole('combobox', { name: /message\.recipient/ })
    const options = Array.from(selector.querySelectorAll('option')).map((option) => option.value)
    expect(options).toEqual([...[''], ...RECIPIENTS])
  })

  it('muestra botones de publicación y cancelación deshabilitados mientras envía', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => Promise.resolve(undefined))
    renderForm({ onSubmit })
    const textarea = screen.getByLabelText(/message\.content/) as HTMLTextAreaElement
    await user.type(textarea, 'Hola ATINY')
    await user.click(screen.getByRole('button', { name: /message\.publish/ }))
    expect(screen.getByRole('button', { name: /message\.publish/ })).toBeDisabled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('muestra el tiempo de cooldown restante y bloquea la publicación mientras está activo', async () => {
    renderForm({
      submitState: { kind: 'cooldown', retryAfterSeconds: 6 },
    })
    const textarea = screen.getByLabelText(/message\.content/) as HTMLTextAreaElement
    expect(screen.getByText(/6/)).toBeVisible()
    expect(screen.getByText(/message\.cooldown/)).toBeVisible()
    await userEvent.setup().type(textarea, 'Hola ATINY')
    expect(screen.getByRole('button', { name: /message\.publish/ })).toBeDisabled()
  })

  it('muestra un enlace a «Mis mensajes» cuando se alcanza el límite de mensajes', () => {
    const onSubmit = vi.fn(() => Promise.resolve(undefined))
    renderForm({
      submitState: { kind: 'limit' },
      onSubmit,
    })
    const link = screen.getByRole('link', { name: /message\.limitReached\.link/ })
    expect(link).toHaveAttribute('href', expect.stringContaining('/my-messages'))
  })
})
