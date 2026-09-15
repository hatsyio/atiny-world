import { describe, expect, it } from 'vitest'

import {
  renderMessageText,
  validateMessageContent,
} from '../../../../src/domain/messages/content'

describe('validateMessageContent', () => {
  it('accepts exactly 500 visible graphemes and rejects 501', () => {
    expect(validateMessageContent('a'.repeat(500))).toEqual({ ok: true })
    expect(validateMessageContent('a'.repeat(501))).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    })
  })

  it('counts a composed emoji as one grapheme', () => {
    expect(validateMessageContent('👨‍👩‍👧‍👦'.repeat(500))).toEqual({ ok: true })
    expect(validateMessageContent('👨‍👩‍👧‍👦'.repeat(501))).toMatchObject({ ok: false })
  })

  it('preserves Korean and newlines exactly while rejecting attachments', () => {
    const content = '사랑해요 ATINY\n항상 함께해요'
    expect(validateMessageContent(content)).toEqual({ ok: true })
    expect(validateMessageContent(content, { attachments: ['photo.png'] })).toMatchObject({ ok: false })
  })
})

describe('renderMessageText', () => {
  it('returns links as plain text rather than a clickable URL', () => {
    expect(renderMessageText('Visita https://example.com')).toEqual({
      text: 'Visita https://example.com',
      links: [],
    })
  })
})
