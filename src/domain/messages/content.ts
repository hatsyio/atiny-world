import { z } from 'zod'

export const MAX_GRAPHEMES = 500

export function countGraphemes(content: string): number {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content)].length
}

export const messageContentSchema = z.string({ error: 'message.content.required' })
  .min(1, { error: 'message.content.required' })
  .refine(content => countGraphemes(content) <= MAX_GRAPHEMES, { error: 'message.content.limitReached' })

export type ContentValidation =
  | { ok: true }
  | { ok: false; code: 'VALIDATION_ERROR'; field: 'content' | 'attachments' }

export function validateMessageContent(
  content: string,
  options: { attachments?: readonly unknown[] } = {},
): ContentValidation {
  if (options.attachments && options.attachments.length > 0) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'attachments' }
  }
  if (!messageContentSchema.safeParse(content).success) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'content' }
  }
  return { ok: true }
}

export function renderMessageText(content: string): { text: string; links: [] } {
  return { text: content, links: [] }
}
