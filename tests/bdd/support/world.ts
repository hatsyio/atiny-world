import {
  setWorldConstructor,
  World,
  type IWorldOptions,
} from '@cucumber/cucumber'

import type {
  ClerkAuthReader,
  SessionIdentity,
} from '../../../src/server/auth/session'

export class AtinyWorld extends World {
  actualName?: string
  authReader?: ClerkAuthReader
  sessionIdentity?: SessionIdentity | null

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(AtinyWorld)
