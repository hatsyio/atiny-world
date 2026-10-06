// Shared stable codes. Labels live in the typed en/es catalogs; never display raw codes.
export const MODERATION_REASON_CODES = ['spam', 'conduct', 'privacy', 'community_guidelines'] as const
export type ModerationReasonCode = (typeof MODERATION_REASON_CODES)[number]

export function isModerationReasonCode(value: unknown): value is ModerationReasonCode {
  return typeof value === 'string' && (MODERATION_REASON_CODES as readonly string[]).includes(value)
}
