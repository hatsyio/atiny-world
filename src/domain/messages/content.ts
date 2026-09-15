import { isRecipient, type Recipient } from '@/domain/contracts'

const MAX_GRAPHEMES = 500

export type ContentValidation =
  | { ok: true }
  | { ok: false; code: 'VALIDATION_ERROR'; field: 'content' | 'attachments' | 'recipient' }

export function validateMessageContent(
  content: string,
  options: { attachments?: readonly unknown[]; recipient?: unknown } = {},
): ContentValidation {
  if (options.attachments && options.attachments.length > 0) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'attachments' }
  }
  if (options.recipient !== undefined && !isRecipient(options.recipient)) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'recipient' }
  }
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content)
  if (content.length === 0 || [...graphemes].length > MAX_GRAPHEMES) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'content' }
  }
  return { ok: true }
}

export function renderMessageText(content: string): { text: string; links: [] } {
  return { text: content, links: [] }
}

export function validateRecipient(recipient: unknown): recipient is Recipient {
  return isRecipient(recipient)
}
