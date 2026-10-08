import { messageContentSchema } from '@/domain/messages/content'

export function validateActionContent(
  content: unknown,
): { ok: true; value: string } | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = messageContentSchema.safeParse(content)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, fieldErrors: { content: parsed.error.issues[0].message } }
}
