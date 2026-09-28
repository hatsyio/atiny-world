import { describe, expect, it } from 'vitest'

import { getPublicAppIdentity } from '../../../src/app-identity'

describe('getPublicAppIdentity', () => {
  it('returns the public application name', () => {
    expect(getPublicAppIdentity()).toEqual({ name: 'atiny world' })
  })
})
