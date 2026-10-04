'use server'

import type { ActionResult } from '@/domain/contracts'
import {
  createMessageForSession,
  type CreateMessageActionInput,
  type CreateMessageForSessionSuccess,
} from '@/server/actions/create-message'
import { runAction } from '@/server/actions/result'
import { getDb } from '@/server/db/client'

export type CreateMessageActionResult = ActionResult<CreateMessageForSessionSuccess>

export async function createMessageAction(
  input: CreateMessageActionInput,
): Promise<CreateMessageActionResult> {
  return runAction(() => createMessageForSession(getDb(), input))
}