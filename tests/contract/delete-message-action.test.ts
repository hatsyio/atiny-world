import { describe, expect, it, vi } from 'vitest'
import type { Sql } from 'postgres'

vi.mock('server-only', () => ({}))

import { errorResult, okResult } from '../../src/domain/contracts'
import {
  deleteMessageForSession,
  type DeleteMessageActionInput,
  type DeleteMessageForSessionDependencies,
  type MessageDeleter,
} from '../../src/server/actions/delete-message'

const PUBLIC_ID = '00000000-0000-4000-8000-000000000001'

const stubSql = {} as unknown as Sql

function deps(
  overrides: Partial<DeleteMessageForSessionDependencies> = {},
): DeleteMessageForSessionDependencies {
  return {
    readAuth: async () => ({ clerkUserId: 'delete-action-fan' }),
    ...overrides,
  }
}

const deleteInput: DeleteMessageActionInput = {
  publicId: PUBLIC_ID,
  expectedVersion: 3,
  confirmation: true,
}

describe('deleteMessage server action contract', () => {
  it('rejects an anonymous session without forwarding the payload', async () => {
    const spy = vi.fn<MessageDeleter>()
    const result = await deleteMessageForSession(stubSql, deleteInput, deps({
      readAuth: async () => null,
      delete: spy,
    }))

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'auth.unauthenticated' } })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects an invalid publicId and a non-positive expectedVersion without forwarding', async () => {
    const spy = vi.fn<MessageDeleter>()
    const badId = await deleteMessageForSession(stubSql, {
      ...deleteInput,
      publicId: 'not-a-uuid',
    }, deps({ delete: spy }))
    expect(badId).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    expect(spy).not.toHaveBeenCalled()

    const badVersion = await deleteMessageForSession(stubSql, {
      ...deleteInput,
      expectedVersion: 0,
    }, deps({ delete: spy }))
    expect(badVersion).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { expectedVersion: 'message.expectedVersion.invalid' } },
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('demands an explicit confirmation before deleting', async () => {
    const spy = vi.fn<MessageDeleter>()
    const result = await deleteMessageForSession(stubSql, {
      ...deleteInput,
      confirmation: false,
    } as unknown as DeleteMessageActionInput, deps({ delete: spy }))

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { confirmation: 'message.confirmation.required' } },
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('forwards the confirmed ownership to the data layer and reports deletion', async () => {
    const spy = vi.fn<MessageDeleter>(async () => okResult({ deleted: true }))
    const result = await deleteMessageForSession(stubSql, deleteInput, deps({ delete: spy }))

    expect(spy).toHaveBeenCalledWith({
      clerkUserId: 'delete-action-fan',
      publicId: PUBLIC_ID,
      expectedVersion: 3,
      confirmation: true,
    })
    expect(result).toEqual({ ok: true, data: { deleted: true } })
  })

  it('passes through a stable ownership failure without exposing the payload', async () => {
    const missing = vi.fn<MessageDeleter>(async () =>
      errorResult('NOT_FOUND', { messageKey: 'message.notFound' }))
    const result = await deleteMessageForSession(stubSql, deleteInput, deps({ delete: missing }))

    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', messageKey: 'message.notFound' },
    })
    expect(JSON.stringify(result)).not.toContain(PUBLIC_ID)
  })
})