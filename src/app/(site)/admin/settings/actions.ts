'use server'

import { revalidatePath } from 'next/cache'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { updateSettings } from '@/server/moderation/settings'
import { captureServerEvent } from '@/server/observability/posthog'

export type SettingsActionState = {
  status: 'idle' | 'saved' | 'denied' | 'invalid' | 'conflict' | 'error'
  hiddenPendingMessages?: number
  appearingPendingMessages?: number
}

function integer(value: FormDataEntryValue | null, minimum: number): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null
}

export async function updateSettingsAction(_previous: SettingsActionState, form: FormData): Promise<SettingsActionState> {
  const identity = await getSessionIdentity()
  if (!identity) return { status: 'denied' }
  const premoderationEnabled = form.get('premoderationEnabled')
  const messageLimit = integer(form.get('messageLimit'), 1)
  const cooldownSeconds = integer(form.get('cooldownSeconds'), 0)
  const expectedVersion = integer(form.get('expectedVersion'), 1)
  const expectedPendingActiveMessages = integer(form.get('expectedPendingActiveMessages'), 0)
  const confirmedImpact = form.get('confirmedImpact')
  if ((premoderationEnabled !== 'true' && premoderationEnabled !== 'false') || (confirmedImpact !== 'true' && confirmedImpact !== 'false') || messageLimit === null || cooldownSeconds === null || expectedVersion === null || expectedPendingActiveMessages === null) {
    return { status: 'invalid' }
  }
  try {
    const result = await updateSettings(getDb(), {
      clerkUserId: identity.clerkUserId,
      premoderationEnabled: premoderationEnabled === 'true',
      messageLimit,
      cooldownSeconds,
      expectedVersion,
      expectedPendingActiveMessages,
      confirmedImpact: confirmedImpact === 'true',
    })
    if (!result.ok) {
      if (result.error.code === 'MESSAGE_VERSION_CONFLICT') return { status: 'conflict' }
      return { status: result.error.code === 'VALIDATION_ERROR' ? 'invalid' : 'denied' }
    }
    await captureServerEvent(identity.clerkUserId, 'moderation_settings_updated', {
      premoderation_enabled: premoderationEnabled === 'true',
      message_limit: messageLimit,
      cooldown_seconds: cooldownSeconds,
      confirmed_impact: confirmedImpact === 'true',
    })
    for (const path of ['/', '/messages', '/my-messages', '/admin/settings']) revalidatePath(path)
    return {
      status: 'saved',
      hiddenPendingMessages: result.data.hiddenPendingMessages,
      appearingPendingMessages: result.data.appearingPendingMessages,
    }
  } catch {
    return { status: 'error' }
  }
}
