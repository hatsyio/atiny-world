import { describe, expect, it } from 'vitest'

import { createHealthResponse } from '../../../../src/server/db/health-response'

describe('createHealthResponse', () => {
  it('returns a successful public response for a healthy database', async () => {
    const response = await createHealthResponse(async () => ({ database: 'ok' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ database: 'ok' })
  })

  it('returns a sanitized unavailable response when the probe fails', async () => {
    const response = await createHealthResponse(async () => {
      throw new Error('internal database details')
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ database: 'unavailable' })
  })
})
