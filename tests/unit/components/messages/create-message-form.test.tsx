/** @vitest-environment jsdom */

import { act } from 'react'
import { cleanup, fireEvent,  screen } from '@testing-library/react'
import { render, IntlTestProvider } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CreateMessageActionResult } from '@/app/(site)/actions/create-message'
import type { CreateMessageActionInput } from '@/server/actions/create-message'
import {
  CreateMessageForm,
  type CreateMessageFormProps,
  type CreateMessageSubmit,
} from '@/components/messages/create-message-form'
import type { LocationPickerSelection } from '@/components/map/location-picker'
import { type ProblemCode } from '@/domain/contracts'

const picker = vi.hoisted(() => ({
  onChange: null as ((value: unknown) => void) | null,
}))

vi.mock('@/app/(site)/actions/create-message', () => ({
  createMessageAction: vi.fn(),
}))

vi.mock('@/components/map/location-picker', () => ({
  LocationPicker: ({ onChange }: { onChange: (value: unknown) => void }) => {
    picker.onChange = onChange
    return <div data-testid="location-picker" />
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(cleanup)

function okResult(publicId: string): CreateMessageActionResult {
  return { ok: true, data: { publicId, version: 1, status: 'pending', publicVisible: false } }
}

function failResult(
  code: ProblemCode,
  details: {
    messageKey: string
    fieldErrors?: Record<string, string>
    retryAfterSeconds?: number
  } = { messageKey: 'error.internal' },
): CreateMessageActionResult {
  return {
    ok: false,
    error: {
      code,
      messageKey: details.messageKey,
      ...(details.fieldErrors !== undefined ? { fieldErrors: details.fieldErrors } : {}),
      ...(details.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: details.retryAfterSeconds }
        : {}),
    },
  }
}

const approximateSelection: LocationPickerSelection = {
  selectionId: 'sel-1',
  precision: 'approximate',
}

function selectLocation(
  value: LocationPickerSelection | null = approximateSelection,
): void {
  act(() => picker.onChange?.(value))
}

async function flushEffects(): Promise<void> {
  await act(async () => {})
}

function renderForm(overrides: Partial<CreateMessageFormProps> = {}) {
  const props: CreateMessageFormProps = {
    lang: 'en',
    onPublished: () => {},
    submitMessage: async () => okResult('message-1'),
    ...overrides,
  }
  return render(<CreateMessageForm {...props} />)
}

function typeContent(text: string): HTMLTextAreaElement {
  const textarea = screen.getByLabelText(/your letter|tu carta/i) as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: text } })
  return textarea
}

// La UI mantiene el mismo contador de grafemas que el servidor (data-model.md:
// content "máximo 500 grafemas"), sin recortar la composición del texto, para
// que coreano, emojis compuestos y saltos de línea se conserven exactos.
describe('CreateMessageForm', () => {
  it('muestra un contador de grafemas visible y actualizado', () => {
    renderForm()
    expect(screen.getByText(/0\/500/)).toBeVisible()
    typeContent('a'.repeat(120))
    expect(screen.getByText(/120\/500/)).toBeVisible()
  })

  it('conserva coreano, emojis y saltos de línea sin alterar el texto', () => {
    const text = '안녕 ATEEZ\n사랑해 😀'
    renderForm()
    const textarea = typeContent(text)
    expect(textarea.value).toBe(text)
    expect(screen.getByText(/14\/500/)).toBeVisible()
  })

  it('permite completar hasta 500 grafemas, alerta a partir de 501 y requiere ubicación', () => {
    renderForm()
    selectLocation()
    typeContent('a'.repeat(501))
    expect(screen.getByRole('button', { name: /publish letter/i })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/too long/i)

    typeContent('a'.repeat(500))
    expect(screen.getByRole('button', { name: /publish letter/i })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('no muestra un selector de destinatario', () => {
    renderForm()
    expect(screen.queryByRole('combobox', { name: /recipient/i })).not.toBeInTheDocument()
  })

  it('mantiene la publicación deshabilitada hasta confirmar una ubicación', async () => {
    const submit = vi.fn<CreateMessageSubmit>(async () => okResult('message-1'))
    renderForm({ submitMessage: submit })

    typeContent('Hola ATINY')
    const publish = screen.getByRole('button', { name: /publish letter/i })
    await fireEvent.click(publish)
    await flushEffects()
    expect(publish).toBeDisabled()
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByText(/search for and confirm a place/i)).toBeVisible()

    selectLocation()
    await fireEvent.click(publish)
    await flushEffects()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('envía contenido y ubicación seleccionada a la acción', async () => {
    const submit = vi.fn<CreateMessageSubmit>(async () => okResult('message-1'))
    renderForm({ submitMessage: submit })

    typeContent('Siempre contigo')
    selectLocation()

    await fireEvent.click(screen.getByRole('button', { name: /publish letter/i }))
    await flushEffects()

    const payload = submit.mock.calls[0][0] as CreateMessageActionInput
    expect(payload).toEqual({
      content: 'Siempre contigo',
      location: approximateSelection,
    })
  })

  it('publica al enviar el formulario con el teclado', async () => {
    const submit = vi.fn<CreateMessageSubmit>(async () => okResult('message-1'))
    const { container } = renderForm({ submitMessage: submit })

    typeContent('Siempre contigo')
    selectLocation()
    fireEvent.submit(container.querySelector('form')!)
    await flushEffects()

    expect(submit).toHaveBeenCalledWith({
      content: 'Siempre contigo',
      location: approximateSelection,
    })
  })

  it('conserva el borrador y bloquea la publicación cuando la selección caduca', async () => {
    const submit = vi.fn(async () => failResult('LOCATION_SELECTION_EXPIRED', { messageKey: 'location.selection_expired' }))
    renderForm({ submitMessage: submit })

    typeContent('Borrador que debe conservarse')
    selectLocation()
    const publish = screen.getByRole('button', { name: /publish letter/i })

    await fireEvent.click(publish)
    await flushEffects()

    expect(screen.getByRole('alert')).toHaveTextContent(/expired/i)
    expect(screen.getByLabelText(/your letter/i)).toHaveValue('Borrador que debe conservarse')
    expect(publish).toBeDisabled()

    selectLocation({ selectionId: 'sel-2', precision: 'approximate' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publish letter/i })).toBeEnabled()
  })

  it('muestra errores comprensibles para validaciones del servidor', async () => {
    const submit = vi.fn(async () => failResult('VALIDATION_ERROR', {
      messageKey: 'validation.invalidFields',
      fieldErrors: { content: 'message.content.required' },
    }))
    renderForm({ submitMessage: submit })

    typeContent('Hola')
    selectLocation()
    await fireEvent.click(screen.getByRole('button', { name: /publish letter/i }))
    await flushEffects()

    expect(screen.getByRole('alert')).toHaveTextContent(/write your letter before publishing/i)
  })

  it('deshabilita los botones mientras envía, confirma el envío y avisa a onPublished', async () => {
    let resolveSubmit!: (value: CreateMessageActionResult) => void
    const submit = vi.fn(() => new Promise<CreateMessageActionResult>((resolve) => {
      resolveSubmit = resolve
    }))
    const onPublished = vi.fn()
    renderForm({ submitMessage: submit, onPublished })

    typeContent('Hola ATINY')
    selectLocation()

    await fireEvent.click(screen.getByRole('button', { name: /publish letter/i }))
    expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()

    await act(async () => {
      resolveSubmit(okResult('message-9'))
    })
    await flushEffects()

    expect(onPublished).toHaveBeenCalledWith('message-9', false)
    expect(screen.getByText(/letter sent/i)).toBeVisible()
  })

  it('informa del cooldown restante en cuenta atrás y bloquea la publicación hasta llegar a cero', async () => {
    vi.useFakeTimers()
    const submit = vi.fn(async () => failResult('MESSAGE_COOLDOWN_ACTIVE', {
      messageKey: 'message.cooldown',
      retryAfterSeconds: 3,
    }))
    renderForm({ submitMessage: submit, lang: 'es' })

    typeContent('Hola ATINY')
    selectLocation()
    const publish = screen.getByRole('button', { name: /publicar carta/i })

    await fireEvent.click(publish)
    await flushEffects()

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent(/podrás publicar otra carta en 3 segundos/i)
    expect(publish).toBeDisabled()

    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/2 segundos/)).toBeTruthy()

    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/1 segundo/)).toBeTruthy()

    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /publicar carta/i })).toBeEnabled()
  })

  it('muestra el límite con un enlace real a «Mis cartas» y mantiene la publicación bloqueada', async () => {
    const submit = vi.fn(async () => failResult('MESSAGE_LIMIT_REACHED', { messageKey: 'message.limitReached' }))
    renderForm({ submitMessage: submit, lang: 'es' })

    typeContent('Hola ATINY')
    selectLocation()
    await fireEvent.click(screen.getByRole('button', { name: /publicar carta/i }))
    await flushEffects()

    expect(screen.getByRole('alert')).toHaveTextContent(/límite/i)
    const link = screen.getByRole('link', { name: /mis cartas/i })
    expect(link).toHaveAttribute('href', '/my-messages')
    expect(screen.getByRole('button', { name: /publicar carta/i })).toBeDisabled()
  })

  it('muestra un error general cuando la publicación falla sin código estable conocido', async () => {
    const submit = vi.fn(async () => failResult('INTERNAL_ERROR', { messageKey: 'error.internal' }))
    renderForm({ submitMessage: submit })

    typeContent('Hola ATINY')
    selectLocation()
    await fireEvent.click(screen.getByRole('button', { name: /publish letter/i }))
    await flushEffects()

    expect(screen.getByRole('alert')).toHaveTextContent(/could not publish/i)
  })

  it('acompaña cada control con una etiqueta accesible', () => {
    renderForm()
    expect(screen.getByLabelText(/your letter/i)).toBeTruthy()
    expect(screen.getByTestId('location-picker')).toBeTruthy()
  })
})

it('retains exact draft, selected location and submission error through a live locale change', async () => {
  vi.useRealTimers()
  const content = '안녕하세요 👩🏽‍🚀\n사랑해요'
  const location = {selectionId:'retained-location', precision:'approximate' as const}
  const submitMessage = vi.fn<CreateMessageSubmit>().mockResolvedValue(failResult('INTERNAL_ERROR'))
  const view = (locale:'en'|'es') => <IntlTestProvider locale={locale}><CreateMessageForm submitMessage={submitMessage}/></IntlTestProvider>
  const result = render(view('en'))
  fireEvent.change(screen.getByRole('textbox', {name:'Your letter'}), {target:{value:content}})
  act(() => picker.onChange?.(location))
  fireEvent.click(screen.getByRole('button', {name:'Publish letter'}))
  await screen.findByText('We could not publish your letter. Try again soon.')
  result.rerender(view('es'))
  expect(screen.getByRole('textbox', {name:'Tu carta'})).toHaveValue(content)
  expect(screen.getByText('No pudimos publicar tu carta. Inténtalo pronto de nuevo.')).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole('button', {name:'Publicar carta'})) })
  await screen.findByText('No pudimos publicar tu carta. Inténtalo pronto de nuevo.')
  expect(submitMessage).toHaveBeenLastCalledWith({content, location})
})

it('ignores repeated keyboard submissions in the same event turn while publishing', async () => {
  vi.useRealTimers()
  let resolve!: (value: CreateMessageActionResult) => void
  const submit = vi.fn<CreateMessageSubmit>(() => new Promise(done => { resolve = done }))
  const onPublished = vi.fn()
  const { container } = renderForm({ submitMessage: submit, onPublished })
  typeContent('One letter only')
  selectLocation()
  act(() => {
    fireEvent.submit(container.querySelector('form')!)
    fireEvent.submit(container.querySelector('form')!)
  })
  expect(submit).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled()
  await act(async () => { resolve(okResult('only-letter')) })
  expect(onPublished).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox', { name: /your letter/i })).toHaveValue('')
})


it('preserves the draft after an exception and allows a fresh successful submission', async () => {
  vi.useRealTimers()
  const submit = vi.fn<CreateMessageSubmit>().mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce(okResult('retry-letter'))
  const onPublished = vi.fn()
  renderForm({ submitMessage: submit, onPublished })
  typeContent('안녕 👩🏽‍🚀\nRetry this draft')
  selectLocation()
  fireEvent.click(screen.getByRole('button', { name: 'Publish letter' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('textbox', { name: 'Your letter' })).toHaveValue('안녕 👩🏽‍🚀\nRetry this draft')
  expect(screen.getByRole('button', { name: 'Publish letter' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Publish letter' }))
  await screen.findByText('Letter sent!')
  expect(submit).toHaveBeenCalledTimes(2)
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0])
  expect(onPublished).toHaveBeenCalledTimes(1)
})
