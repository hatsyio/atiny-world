import { afterEach, describe, expect, it, vi } from 'vitest'

import { register } from '../../src/instrumentation'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('server startup', () => {
  it('rejects an incomplete production environment before serving requests', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/app')
    vi.stubEnv('CLERK_SECRET_KEY', '')

    await expect(register()).rejects.toThrow('CLERK_SECRET_KEY')
  })
})
