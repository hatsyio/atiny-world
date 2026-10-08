/** @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { render } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MessageStatus } from '@/domain/contracts'
import { MyMessageList } from '@/components/messages/my-message-list'

// Contrato de T060: la lista recibe mensajes propios con estado y motivo en
// bruto (codes estables) y traduce ambos para la autora. Este tipo se
// trasladará a los exports del componente cuando se implemente.
interface OwnMessageListItem {
  publicId: string
  version: number
  status: MessageStatus
  moderationReasonCode: string | null
  moderationNote: string | null
  content: string
  publicVisible?: boolean
  point?: { latitude: number; longitude: number }
}

const statusLabels = {
  en: {
    pending: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  },
  es: {
    pending: 'Pendiente de revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    withdrawn: 'Retirado',
  },
} as const

const reasonLabels = {
  en: {
    spam: 'Spam or unsolicited content',
    conduct: 'Harassment or misconduct',
  },
  es: {
    spam: 'Contenido no deseado',
    conduct: 'Acoso o mala conducta',
  },
} as const

const actionCopy = {
  en: {
    edit: 'Edit letter',
    delete: 'Delete letter',
    confirm: 'Confirm deletion',
    keep: 'Keep letter',
    confirmHint: 'This letter will be deleted permanently. This frees one slot of your limit and cannot be undone.',
  },
  es: {
    edit: 'Editar carta',
    delete: 'Eliminar carta',
    confirm: 'Confirmar eliminación',
    keep: 'Conservar carta',
    confirmHint: 'Esta carta se eliminará de forma permanente. Libera un hueco de tu límite y no se puede deshacer.',
  },
} as const

function message(overrides: Partial<OwnMessageListItem> = {}): OwnMessageListItem {
  return {
    publicId: 'msg-1',
    version: 3,
    status: 'approved',
    moderationReasonCode: null,
    moderationNote: null,
    content: 'Siempre contigo',
    ...overrides,
  }
}

function renderList({
  locale = 'en' as 'en' | 'es',
  messages = [message()],
  accountSuspended = false,
  onDelete = vi.fn<(publicId: string, expectedVersion: number) => void>(),
  onEdit = vi.fn<(publicId: string, expectedVersion: number) => void>(),
} = {}) {
  render(
    <MyMessageList
      messages={messages}
      accountSuspended={accountSuspended}
      onDelete={onDelete}
      onEdit={onEdit}
    />,
    { locale },
  )
  return { onDelete, onEdit }
}

function entry(name: string | RegExp) {
  return within(screen.getByRole('listitem', { name }))
}

afterEach(cleanup)

describe('MyMessageList presenta estado y motivo', () => {
  it('permite leer y compartir una carta pendiente que ya es pública', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderList({ messages: [message({ status: 'pending', publicVisible: true, point: { latitude: 40.4, longitude: -3.7 } })] })
    expect(screen.getByRole('link', { name: 'View letter' })).toHaveAttribute('href', expect.stringContaining('/messages/msg-1?returnTo='))
    expect(screen.getByRole('link', { name: 'View on map' })).toHaveAttribute('href', '/?letter=msg-1#map')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/messages/msg-1`))
    expect(screen.getByRole('status')).toHaveTextContent('Link copied')
  })

  it.each(['pending', 'rejected', 'withdrawn'] as const)('conserva la lectura privada sin compartir una carta %s', status => {
    renderList({ messages: [message({ status, publicVisible: false })] })
    expect(screen.getByRole('link', { name: 'View letter' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'View on map' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })

  it('no ofrece compartir cartas de una cuenta suspendida', () => {
    renderList({ accountSuspended: true, messages: [message({ publicVisible: false })] })
    expect(screen.getByRole('link', { name: 'View letter' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
  })

  it('explica el fallo del portapapeles sin afirmar que se copió', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    renderList({ messages: [message({ publicVisible: true })] })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Could not copy the link')
  })
  it('muestra a la autora el estado y el motivo traducido de un mensaje rechazado', () => {
    renderList({
      locale: 'es',
      messages: [
        message({
          publicId: 'msg-rechazada',
          status: 'rejected',
          moderationReasonCode: 'spam',
          moderationNote: 'Nota privada de moderación',
          content: 'Carta rechazada',
        }),
      ],
    })

    const item = entry(/Carta rechazada/)
    expect(item.getByText(statusLabels.es.rejected)).toBeVisible()
    expect(item.getByText(reasonLabels.es.spam)).toBeVisible()
    expect(item.getByText('Nota privada de moderación')).toBeVisible()
  })

  it('muestra el estado y el motivo de un mensaje retirado', () => {
    renderList({
      messages: [
        message({
          publicId: 'msg-retirada',
          status: 'withdrawn',
          moderationReasonCode: 'conduct',
          moderationNote: 'Private moderation note',
          content: 'Carta retirada',
        }),
      ],
    })

    const item = entry(/Carta retirada/)
    expect(item.getByText(statusLabels.en.withdrawn)).toBeVisible()
    expect(item.getByText(reasonLabels.en.conduct)).toBeVisible()
    expect(item.getByText('Private moderation note')).toBeVisible()
  })

  it('muestra el estado de los cuatro estados y el motivo solo cuando existe', () => {
    renderList({
      locale: 'es',
      messages: [
        message({ status: 'pending', content: 'Carta pendiente' }),
        message({ status: 'approved', content: 'Carta aprobada' }),
        message({
          status: 'rejected',
          moderationReasonCode: 'spam',
          content: 'Carta rechazada',
        }),
        message({
          status: 'withdrawn',
          moderationReasonCode: 'conduct',
          content: 'Carta retirada',
        }),
      ],
    })

    for (const [, label] of Object.entries(statusLabels.es) as [
      MessageStatus,
      string,
    ][]) {
      expect(screen.getAllByText(label)).toHaveLength(1)
    }
    expect(screen.getAllByText(reasonLabels.es.spam)).toHaveLength(1)
    expect(screen.getAllByText(reasonLabels.es.conduct)).toHaveLength(1)
    expect(entry(/Carta pendiente/).queryByText(reasonLabels.es.spam)).not.toBeInTheDocument()
    expect(entry(/Carta aprobada/).queryByText(reasonLabels.es.spam)).not.toBeInTheDocument()
  })
})

describe('MyMessageList confirma el borrado antes de eliminar', () => {
  it('no elimina al pulsar eliminar y exige una confirmación expresa', () => {
    const { onDelete } = renderList({
      messages: [message({ publicId: 'msg-borrar', version: 2, content: 'Carta a borrar' })],
    })

    const item = entry(/Carta a borrar/)
    const deleteButton = item.getByRole('button', { name: /delete/i })

    fireEvent.click(deleteButton)
    expect(onDelete).not.toHaveBeenCalled()

    expect(item.getByText(actionCopy.en.confirmHint)).toBeVisible()
    item.getByRole('button', { name: /confirm/i })
    const keepButton = item.getByRole('button', { name: /keep/i })

    fireEvent.click(keepButton)
    expect(onDelete).not.toHaveBeenCalled()
    expect(item.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()

    fireEvent.click(item.getByRole('button', { name: /delete/i }))
    fireEvent.click(item.getByRole('button', { name: /confirm/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('msg-borrar', 2)
  })
})

describe('MyMessageList limita los controles de una cuenta suspendida', () => {
  it('oculta la edición y conserva la eliminación con su confirmación', () => {
    const { onDelete } = renderList({
      locale: 'es',
      accountSuspended: true,
      messages: [message({ publicId: 'msg-suspendida', content: 'Carta con suspensión' })],
    })

    const item = entry(/Carta con suspensión/)
    expect(item.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()

    fireEvent.click(item.getByRole('button', { name: /eliminar/i }))
    item.getByRole('button', { name: /confirmar/i })
    fireEvent.click(item.getByRole('button', { name: /confirmar/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('msg-suspendida', 3)
  })

  it('mantiene la edición disponible en una cuenta activa', () => {
    renderList({
      messages: [message({ content: 'Carta activa' })],
    })

    const item = entry(/Carta activa/)
    expect(item.getByRole('button', { name: /edit/i })).toBeVisible()
    expect(item.getByRole('button', { name: /delete/i })).toBeVisible()
  })
})
