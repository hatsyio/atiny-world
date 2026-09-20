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
  createMessageForSession,
  type CreateMessageActionInput,
  type CreateMessageForSessionDependencies,
  type MessagePublisher,
  type SelectionVerifier,
} from '../../src/server/actions/create-message'

const SECRET = 'contract-test-secret'
const ISSUED_AT = new Date('2026-09-20T12:00:00Z')
const SELECTION: LocationSelection = {
  locality: 'Madrid',
  country: 'España',
  countryCode: 'es',
  point: { latitude: 40.4168, longitude: -3.7038 },
  attribution: 'Geoapify',
}

const stubSql = {} as unknown as Sql

const validSelectionId = () => signLocationSelection(SELECTION, SECRET, ISSUED_AT)

const verifySelection: SelectionVerifier = (token) =>
  verifyLocationSelectionResult(token, SECRET, ISSUED_AT)

function deps(
  overrides: Partial<CreateMessageForSessionDependencies> = {},
): CreateMessageForSessionDependencies {
  return {
    readAuth: async () => ({ clerkUserId: 'action-fan' }),
    readProfile: async () => ({
      id: 'profile-1',
      public_id: '00000000-0000-4000-8000-000000000001',
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

const approximateInput: CreateMessageActionInput = {
  content: 'Siempre contigo',
  recipient: 'ateez',
  location: { selectionId: validSelectionId(), precision: 'approximate' },
}

const preciseInput: CreateMessageActionInput = {
  content: 'Estoy aquí',
  recipient: null,
  location: {
    selectionId: validSelectionId(),
    precision: 'precise',
    confirmedPublicPoint: { latitude: 40.42, longitude: -3.69 },
    preciseLocationConfirmed: true,
  },
}

describe('createMessage server action contract', () => {
  it('rejects an anonymous session without reading profile or payload', async () => {
    const spy = vi.fn()
    const result = await createMessageForSession(stubSql, approximateInput, deps({
      readAuth: async () => null,
      publish: spy,
    }))

    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND', messageKey: 'auth.unauthenticated' } })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects an incomplete or suspended profile before publishing', async () => {
    const incomplete = await createMessageForSession(stubSql, approximateInput, deps({
      readProfile: async () => null,
    }))
    expect(incomplete).toMatchObject({
      ok: false,
      error: { code: 'PROFILE_INCOMPLETE', messageKey: 'profile.incomplete' },
    })

    const suspended = await createMessageForSession(stubSql, approximateInput, deps({
      readProfile: async () => ({
        id: 'profile-1',
        public_id: '00000000-0000-4000-8000-000000000001',
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

  it('requires a selection when the selectionId is missing', async () => {
    const spy = vi.fn()
    const result = await createMessageForSession(stubSql, {
      ...approximateInput,
      location: { selectionId: '', precision: 'approximate' },
    }, deps({ publish: spy }))

    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_REQUIRED', messageKey: 'location.selection_required' },
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects precise locations that were not explicitly confirmed', async () => {
    const result = await createMessageForSession(stubSql, {
      ...preciseInput,
      location: {
        selectionId: validSelectionId(),
        precision: 'precise',
      },
    } as unknown as CreateMessageActionInput, deps())

    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_REQUIRED', messageKey: 'location.selection_required' },
    })
  })

  it('rejects a tampered selection token as invalid without leaking data', async () => {
    const result = await createMessageForSession(stubSql, {
      ...approximateInput,
      location: { selectionId: `${validSelectionId()}tampered`, precision: 'approximate' },
    }, deps())

    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_INVALID', messageKey: 'location.selection_invalid' },
    })
  })

  it('rejects an expired selection token', async () => {
    const expired = signLocationSelection(SELECTION, SECRET, new Date('2026-09-20T11:50:00Z'))
    const result = await createMessageForSession(stubSql, {
      ...approximateInput,
      location: { selectionId: expired, precision: 'approximate' },
    }, deps())

    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCATION_SELECTION_EXPIRED', messageKey: 'location.selection_expired' },
    })
  })

  it('rejects empty or oversized content and unknown recipients with field errors', async () => {
    const empty = await createMessageForSession(stubSql, {
      ...approximateInput,
      content: '',
    }, deps())
    expect(empty).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { content: 'message.content.required' } },
    })

    const oversized = await createMessageForSession(stubSql, {
      ...approximateInput,
      content: 'a'.repeat(501),
    }, deps())
    expect(oversized).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { content: 'message.content.limitReached' } },
    })

    const recipient = await createMessageForSession(stubSql, {
      ...approximateInput,
      recipient: 'ateez2',
    } as unknown as CreateMessageActionInput, deps())
    expect(recipient).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', fieldErrors: { recipient: 'message.recipient.invalid' } },
    })
  })

  it('forwards the approximate selection center to the publish transaction', async () => {
    const spy = vi.fn<MessagePublisher>(async () => okResult({ publicId: 'message-1', status: 'pending' }))
    const result = await createMessageForSession(stubSql, approximateInput, deps({ publish: spy }))

    expect(spy).toHaveBeenCalledWith({
      clerkUserId: 'action-fan',
      content: 'Siempre contigo',
      recipient: 'ateez',
      location: {
        precision: 'approximate',
        localityCenter: SELECTION.point,
        country: 'España',
        countryCode: 'es',
      },
    })
    expect(result).toEqual({ ok: true, data: { publicId: 'message-1', version: 1, status: 'pending' } })
  })

  it('forwards the confirmed precise point and explicit confirmation to the publish transaction', async () => {
    const spy = vi.fn<MessagePublisher>(async () => okResult({ publicId: 'message-1', status: 'pending' }))
    const result = await createMessageForSession(stubSql, preciseInput, deps({ publish: spy }))

    expect(spy).toHaveBeenCalledWith({
      clerkUserId: 'action-fan',
      content: 'Estoy aquí',
      recipient: null,
      location: {
        precision: 'precise',
        localityCenter: { latitude: 40.42, longitude: -3.69 },
        confirmed: true,
        country: 'España',
        countryCode: 'es',
      },
    })
    expect(result).toEqual({ ok: true, data: { publicId: 'message-1', version: 1, status: 'pending' } })
  })

  it('passes through stable business errors and never exposes the token or address', async () => {
    const limited = await createMessageForSession(stubSql, approximateInput, deps({
      publish: async () => errorResult('MESSAGE_LIMIT_REACHED', { messageKey: 'message.limitReached' }),
    }))
    expect(limited).toEqual({
      ok: false,
      error: { code: 'MESSAGE_LIMIT_REACHED', messageKey: 'message.limitReached' },
    })

    const cooldown = await createMessageForSession(stubSql, approximateInput, deps({
      publish: async () => errorResult('MESSAGE_COOLDOWN_ACTIVE', {
        messageKey: 'message.cooldown',
        retryAfterSeconds: 7,
      }),
    }))
    expect(cooldown).toMatchObject({ ok: false, error: { code: 'MESSAGE_COOLDOWN_ACTIVE', retryAfterSeconds: 7 } })

    const invalid = await createMessageForSession(stubSql, {
      ...approximateInput,
      location: { selectionId: `secret address never ${validSelectionId()}`, precision: 'approximate' },
    }, deps())
    expect(JSON.stringify(invalid)).not.toContain('secret address never')
  })
})