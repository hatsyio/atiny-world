'use server'

import type { ActionResult } from '@/domain/contracts'
import {
  deleteMessageForSession,
  type DeleteMessageActionInput,
  type DeleteMessageForSessionSuccess,
} from '@/server/actions/delete-message'
import { runAction } from '@/server/actions/result'
import { getDb } from '@/server/db/client'

export type DeleteMessageActionResult = ActionResult<DeleteMessageForSessionSuccess>

export async function deleteMessageAction(
  input: DeleteMessageActionInput,
): Promise<DeleteMessageActionResult> {
  return runAction(() => deleteMessageForSession(getDb(), input))
}