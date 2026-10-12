/** @vitest-environment jsdom */

import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { render } from '../../../support/intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MessageStatus } from '@/domain/contracts'
import { MyMessageList } from '@/components/messages/my-message-list'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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
    approved: 'Aprobada',
    rejected: 'Rechazada',
    withdrawn: 'Retirada',
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
} = {}) {
  render(
    <MyMessageList
      messages={messages}
      accountSuspended={accountSuspended}
      onDelete={onDelete}
    />,
    { locale },
  )
  return { onDelete }
}

function entry(name: string | RegExp) {
  return within(screen.getByRole('listitem', { name }))
}

afterEach(cleanup)

describe('MyMessageList presenta estado y motivo', () => {
  it('permite leer una carta pública y verla en el mapa sin ofrecer compartir todavía', () => {
    renderList({ messages: [message({ status: 'pending', publicVisible: true })] })
    expect(screen.getByRole('link', { name: 'View letter' })).toHaveAttribute('href', expect.stringContaining('/messages/msg-1?returnTo='))
    expect(screen.getByRole('link', { name: 'View on map' })).toHaveAttribute('href', '/?letter=msg-1#map')
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
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

    const dialog = within(screen.getByRole('alertdialog', { name: 'Delete letter' }))
    expect(dialog.getByText(actionCopy.en.confirmHint)).toBeVisible()
    const keepButton = dialog.getByRole('button', { name: /keep/i })

    fireEvent.click(keepButton)
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(item.getByRole('button', { name: /delete/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
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
    screen.getByRole('alertdialog', { name: 'Eliminar carta' })
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('msg-suspendida', 3)
  })

  it('permite abrir la carta sin duplicar el acceso a edición en una cuenta activa', () => {
    renderList({
      messages: [message({ content: 'Carta activa' })],
    })

    const item = entry(/Carta activa/)
    expect(item.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(item.getByRole('link', { name: 'View letter' })).toBeVisible()
    expect(item.getByRole('button', { name: 'Delete letter' })).toBeVisible()
  })
})

it('shares a public own letter directly from the list', () => {
  render(<MyMessageList messages={[{...message({publicVisible:true}), locality:'Barcelona', country:'España'}]} shareContext={{origin:'https://atinyatlas.com', author:{publicId:'author', displayName:'Josep'}}} />)
  fireEvent.click(screen.getByRole('button', {name:'Share'}))
  expect(screen.getByRole('dialog', {name:'Share your letter'})).toBeVisible()
  expect(screen.getByRole('link', {name:'Threads'})).toHaveAttribute('href', expect.stringContaining('msg-1'))
})
it.each([false, true])('does not share an unavailable or suspended own letter (suspended=%s)', accountSuspended => {
  render(<MyMessageList messages={[message({publicVisible:accountSuspended})]} accountSuspended={accountSuspended} shareContext={{origin:'https://atinyatlas.com', author:{publicId:'author', displayName:'Josep'}}} />)
  expect(screen.queryByRole('button', {name:'Share'})).toBeNull()
})
