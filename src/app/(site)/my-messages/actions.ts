'use server'

import type { ActionResult } from '@/domain/contracts'
import {
  updateMessageForSession,
  type UpdateMessageActionInput,
  type UpdateMessageForSessionSuccess,
} from '@/server/actions/update-message'
import { runAction } from '@/server/actions/result'
import { getDb } from '@/server/db/client'

export type UpdateMessageActionResult = ActionResult<UpdateMessageForSessionSuccess>

export async function updateMessageAction(
  input: UpdateMessageActionInput,
): Promise<UpdateMessageActionResult> {
  return runAction(() => updateMessageForSession(getDb(), input))
}