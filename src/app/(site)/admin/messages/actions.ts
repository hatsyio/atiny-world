'use server'

import { revalidatePath } from 'next/cache'
import { validateModerationDecision } from '@/domain/moderation/policies'
import { parsePublicId } from '@/domain/contracts'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { moderateMessage } from '@/server/moderation/moderate-message'
import { captureServerEvent } from '@/server/observability/posthog'

export type ModerationActionState = { status: 'idle' | 'saved' | 'denied' | 'invalid' | 'conflict' | 'transition' | 'error' }

export async function moderateMessageAction(_previous: ModerationActionState, form: FormData): Promise<ModerationActionState> {
  const identity = await getSessionIdentity()
  if (!identity) return { status: 'denied' }
  const publicId = form.get('publicId')
  const version = form.get('expectedVersion')
  const decision = form.get('decision')
  const reasonCode = form.get('reasonCode') ?? undefined
  const note = form.get('note') ?? undefined
  const validated = validateModerationDecision({ decision, reasonCode, note })
  if (typeof publicId !== 'string' || !parsePublicId(publicId).ok || typeof version !== 'string' || !/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(Number(version)) || Number(version) >= 2147483647 || !validated.ok) return { status: 'invalid' }
  try {
    const result = await moderateMessage(getDb(), {
      clerkUserId: identity.clerkUserId, publicId, expectedVersion: Number(version),
      decision: validated.data.decision,
      ...(typeof reasonCode === 'string' ? { reasonCode } : {}),
      ...(typeof note === 'string' ? { note } : {}),
    })
    if (!result.ok) return { status: result.error.code === 'MESSAGE_VERSION_CONFLICT' ? 'conflict' : result.error.code === 'INVALID_MODERATION_TRANSITION' ? 'transition' : result.error.code === 'VALIDATION_ERROR' ? 'invalid' : 'denied' }
  } catch { return { status: 'error' } }
  await captureServerEvent(identity.clerkUserId, 'message_moderated', {
    decision: validated.data.decision,
  })
  for (const path of ['/', '/messages', '/my-messages', '/admin/messages', `/messages/${publicId.toLowerCase()}`]) revalidatePath(path)
  return { status: 'saved' }
}
