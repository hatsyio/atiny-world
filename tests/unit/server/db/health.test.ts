import { describe, expect, it, vi } from 'vitest'

import { checkDatabaseHealth } from '../../../../src/server/db/health'

describe('checkDatabaseHealth', () => {
  it('reports an available database after a successful probe', async () => {
    const query = vi.fn().mockResolvedValue([{ ok: 1 }])

    await expect(checkDatabaseHealth(query)).resolves.toEqual({ database: 'ok' })
    expect(query).toHaveBeenCalledWith('select 1 as ok from app_private.settings where id = 1')
  })

  it('does not turn an empty probe into a healthy result', async () => {
    const query = vi.fn().mockResolvedValue([])

    await expect(checkDatabaseHealth(query)).rejects.toThrowError(
      'Database health probe returned no rows',
    )
  })
})
