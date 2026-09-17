import type { AccountState, MessageStatus } from '../contracts'

export interface VisibilityInput {
  messageStatus: MessageStatus
  premoderationEnabled: boolean
  accountState: AccountState
  suspendedAt: string | null
}

export function isMessagePublic(input: VisibilityInput): boolean {
  return (
    input.accountState === 'active' &&
    input.suspendedAt === null &&
    (input.messageStatus === 'approved' ||
      (input.messageStatus === 'pending' && !input.premoderationEnabled))
  )
}