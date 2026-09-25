import { describe, expect, it, vi } from 'vitest'
import type { Sql } from 'postgres'

vi.mock('server-only', () => ({}))

import { errorResult, okResult } from '../../src/domain/contracts'
import {
  signLocationSelection,
  verifyLocationSelectionResult,
  type LocationSelection,
} from '../../src/server/locations/selection-token'
import {
  updateMessageForSession,
  type MessageUpdater,
  type UpdateMessageActionInput,
  type UpdateMessageForSessionDependencies,
} from '../../src/server/actions/update-message'

const SECRET = 'contract-test-secret'
const ISSUED_AT = new Date('2026-09-20T12:00:00Z')
const SELECTION: LocationSelection = {
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  point: { latitude: 40.4168, longitude: -3.7038 },
  attribution: 'Geoapify',
}
const PUBLIC_ID = '00000000-0000-4000-8000-000000000001'

const stubSql = {} as unknown as Sql
const validSelectionId = () => signLocationSelection(SELECTION, SECRET, ISSUED_AT)
const verifySelection = (token: string) => verifyLocationSelectionResult(token, SECRET, ISSUED_AT)

function deps(
  overrides: Partial<UpdateMessageForSessionDependencies> = {},
): UpdateMessageForSessionDependencies {
  return {
    readAuth: async () => ({ clerkUserId: 'action-fan' }),
    readProfile: async () => ({
      id: 'profile-1',
      public_id: '00000000-0000-4000-8000-000000000002',
      username: 'atiny',
      display_name: 'ATINY',
      role: 'fan',
      account_state: 'active',
      suspended_at: null,
    }),
    verifySelection,
    ...overrides,
  }
}

const textInput: UpdateMessageActionInput = {
  publicId: PUBLIC_ID,
  expectedVersion: 2,
  content: 'Texto corregido',
}

const preciseInput: UpdateMessageActionInput = {
  ...textInput,
  location: {
    selectionId: validSelectionId(),
    precision: 'precise',
    confirmedPublicPoint: { latitude: 40.42, longitude: -3.69 },
    preciseLocationConfirmed: true,
  },
}

describe('updateMessage server action contract', () => {
  it('rejects an anonymous session without reading profile or payload', async () => {
    const spy = vi.fn<MessageUpdater>()
    const result = await updateMessageForSession(stubSql, textInput, deps({
      readAuth: async () => null,
      update: spy,
    }))

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'auth.unauthenticated' } })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects an incomplete or suspended profile before updating', async () => {
    const incomplete = await updateMessageForSession(stubSql, textInput, deps({
      readProfile: async () => null,
    }))
    expect(incomplete).toMatchObject({
      ok: false,
      error: { code: 'PROFILE_INCOMPLETE', messageKey: 'profile.incomplete' },
    })

    const suspended = await updateMessageForSession(stubSql, textInput, deps({
      readProfile: async () => ({
        id: 'profile-1',
        public_id: '00000000-0000-4000-8000-000000000002',
        username: 'atiny',
        display_name: 'ATINY',
        role: 'fan',
        account_state: 'active',
        suspended_at: '2026-09-01T00:00:00Z',
      }),
    }))
    expect(suspended).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_SUSPENDED', messageKey: 'account.suspended' },
    })
  })

  it('rejects an invalid publicId and a non-positive expectedVersion', async () => {
    const badId = await updateMessageForSession(stubSql, {
      ...textInput,
      publicId: 'not-a-uuid',
    }, deps())
    expect(badId).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const badVersion = await updateMessageForSession(stubSql, {
      ...textInput,
      expectedVersion: 0,
    }, deps())
    expect(badVersion).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { expectedVersion: 'message.expectedVersion.invalid' } },
    })
  })

  it('rejects empty or oversized content with field errors', async () => {
    const empty = await updateMessageForSession(stubSql, { ...textInput, content: '' }, deps())
    expect(empty).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { content: 'message.content.required' } },
    })

    const oversized = await updateMessageForSession(stubSql, {
      ...textInput,
      content: 'a'.repeat(501),
    }, deps())
    expect(oversized).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { content: 'message.content.limitReached' } },
    })
  })

  it('allows a text-only edit without resolving a location', async () => {
    const spy = vi.fn<MessageUpdater>(async (input) =>
      okResult({ publicId: input.publicId, version: input.expectedVersion + 1, status: 'pending' }))
    const result = await updateMessageForSession(stubSql, textInput, deps({ update: spy }))

    expect(spy).toHaveBeenCalledWith({
      clerkUserId: 'action-fan',
      publicId: PUBLIC_ID,
      expectedVersion: 2,
      content: 'Texto corregido',
    })
    expect(spy.mock.calls[0]?.[0]).not.toHaveProperty('location')
    expect(result).toEqual({ ok: true, data: { publicId: PUBLIC_ID, version: 3, status: 'pending' } })
  })

  it('requires a valid, unexpired selection when a location is provided', async () => {
    const missing = await updateMessageForSession(stubSql, {
      ...textInput,
      location: { selectionId: '', precision: 'approximate' },
    }, deps())
    expect(missing).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_REQUIRED', messageKey: 'location.selection_required' },
    })

    const tampered = await updateMessageForSession(stubSql, {
      ...textInput,
      location: { selectionId: `${validSelectionId()}tampered`, precision: 'approximate' },
    }, deps())
    expect(tampered).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_INVALID', messageKey: 'location.selection_invalid' },
    })

    const expired = await updateMessageForSession(stubSql, {
      ...textInput,
      location: { selectionId: signLocationSelection(SELECTION, SECRET, new Date('2026-09-20T11:50:00Z')), precision: 'approximate' },
    }, deps())
    expect(expired).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_EXPIRED', messageKey: 'location.selection_expired' },
    })
  })

  it('rejects a precise location that was not explicitly confirmed', async () => {
    const result = await updateMessageForSession(stubSql, {
      ...textInput,
      location: { selectionId: validSelectionId(), precision: 'precise' },
    } as unknown as UpdateMessageActionInput, deps())

    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_REQUIRED', messageKey: 'location.selection_required' },
    })
  })

  it('forwards the resolved location replacement to the data layer', async () => {
    const spy = vi.fn<MessageUpdater>(async (input) =>
      okResult({ publicId: input.publicId, version: input.expectedVersion + 1, status: 'pending' }))

    const approximate = await updateMessageForSession(stubSql, {
      ...textInput,
      location: { selectionId: validSelectionId(), precision: 'approximate' },
    }, deps({ update: spy }))
    expect(approximate).toMatchObject({ ok: true })
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({
      location: {
        precision: 'approximate',
        localityCenter: SELECTION.point,
        country: 'España',
        countryCode: 'es',
      },
    }))

    const precise = await updateMessageForSession(stubSql, preciseInput, deps({ update: spy }))
    expect(precise).toMatchObject({ ok: true })
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({
      location: {
        precision: 'precise',
        localityCenter: { latitude: 40.42, longitude: -3.69 },
        confirmed: true,
        country: 'España',
        countryCode: 'es',
      },
    }))
  })

  it('passes through a stable version conflict without exposing the payload', async () => {
    const conflict = vi.fn<MessageUpdater>(async () =>
      errorResult('MESSAGE_VERSION_CONFLICT', { messageKey: 'message.versionConflict' }))
    const result = await updateMessageForSession(stubSql, textInput, deps({ update: conflict }))

    expect(result).toEqual({
      ok: false,
      error: { code: 'MESSAGE_VERSION_CONFLICT', messageKey: 'message.versionConflict' },
    })
    expect(JSON.stringify(result)).not.toContain('Texto corregido')
  })
})