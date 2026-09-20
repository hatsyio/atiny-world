import { errorResult, type ActionResult } from '@/domain/contracts'

export async function runAction<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run()
  } catch {
    return errorResult('INTERNAL_ERROR', { messageKey: 'error.internal' })
  }
}