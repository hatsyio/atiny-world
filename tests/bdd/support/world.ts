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

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(AtinyWorld)
