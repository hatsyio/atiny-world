import {
  setWorldConstructor,
  World,
  type IWorldOptions,
} from '@cucumber/cucumber'

import type {
  ClerkAuthReader,
  SessionIdentity,
} from '../../../src/server/auth/session'

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

  constructor(options: IWorldOptions) {
    super(options)
  }
}

setWorldConstructor(AtinyWorld)
