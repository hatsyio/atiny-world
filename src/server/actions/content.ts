import { countGraphemes, MAX_GRAPHEMES } from '@/domain/messages/content'

export function validateActionContent(
  content: unknown,
): { ok: true; value: string } | { ok: false; fieldErrors: Record<string, string> } {
  if (typeof content !== 'string' || content.length === 0) {
    return { ok: false, fieldErrors: { content: 'message.content.required' } }
  }
  if (countGraphemes(content) > MAX_GRAPHEMES) {
    return { ok: false, fieldErrors: { content: 'message.content.limitReached' } }
  }
  return { ok: true, value: content }
}