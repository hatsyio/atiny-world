import {
  setWorldConstructor,
  World,
  type IWorldOptions,
} from '@cucumber/cucumber'

import type {
  ClerkAuthReader,
  SessionIdentity,
} from '../../../src/server/auth/session'
import type { AccountGate } from '../../../src/server/auth/account-gate'
import type { ClerkUserReader } from '../../../src/server/actions/complete-profile'
import type { ActionResult } from '../../../src/domain/contracts'
import type { CreateMessageForSessionSuccess } from '../../../src/server/actions/create-message'
import type { OwnMessagePage } from '../../../src/server/messages/own-message-repository'
import type { UpdateMessageForSessionSuccess } from '../../../src/server/actions/update-message'
import type { DeleteMessageForSessionSuccess } from '../../../src/server/actions/delete-message'

export type BddResponse = { status: number; body: Record<string, unknown> }

export class AtinyWorld extends World {
  actualName?: string
  authReader?: ClerkAuthReader
  sessionIdentity?: SessionIdentity | null
  viewport = { west: -10, south: 35, east: 5, north: 45, zoom: 5 }
  responses: BddResponse[] = []
  publicId?: string
  hiddenId?: string
  fanPublicId?: string
  clerkUserId?: string
  clerkUser?: Awaited<ReturnType<ClerkUserReader>>
  profileActionResult?: ActionResult<{ profilePublicId: string }>
  accountGate?: AccountGate
  messageActionResult?: ActionResult<CreateMessageForSessionSuccess>
  locationSelectionId?: string
  selectedAddress?: string
  ownMessages?: OwnMessagePage
  updateResult?: ActionResult<UpdateMessageForSessionSuccess>
  deleteResult?: ActionResult<DeleteMessageForSessionSuccess>
  originalPoint?: { latitude: number; longitude: number }
  foreignClerkUserId?: string

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(AtinyWorld)
