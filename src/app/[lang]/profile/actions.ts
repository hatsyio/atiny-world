'use server'

import {
  completeProfileForSession,
  type CompleteProfileClientInput,
} from '@/server/actions/complete-profile'
import { runAction } from '@/server/actions/result'
import { getDb } from '@/server/db/client'
import type { ActionResult } from '@/domain/contracts'

export type CompleteProfileActionState = ActionResult<{ profilePublicId: string }> | null

export async function completeProfileAction(
  _previousState: CompleteProfileActionState,
  formData: FormData,
): Promise<CompleteProfileActionState> {
  const input: CompleteProfileClientInput = {
    username: String(formData.get('username') ?? ''),
    displayName: String(formData.get('displayName') ?? ''),
  }

  return runAction(() => completeProfileForSession(getDb(), input))
}