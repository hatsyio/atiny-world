// @vitest-environment node
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const lifecycle = vi.hoisted(() => ({
  pending: [] as Array<() => Promise<void>>,
  unavailable: false,
}))
const pending = lifecycle.pending
// Next.js owns the response lifecycle; the HTTP exporter and provider stay real.
vi.mock('next/server', () => ({ after: (work: () => Promise<void>) => {
  if (lifecycle.unavailable) throw new Error('outside request context')
  pending.push(work)
} }))

let server: Server
let requests: Array<{ authorization: string | undefined; body: string }>
let responseStatus: number

beforeEach(async () => {
  vi.resetModules()
  pending.length = 0
  lifecycle.unavailable = false
  requests = []
  responseStatus = 200
  server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk.toString()
    requests.push({ authorization: request.headers.authorization, body })
    response.writeHead(responseStatus, { 'content-type': 'application/json' })
    response.end('{}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-project-token')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

it('delivers OTLP logs after the response without a prior instrumentation registration', async () => {
  const { createLogger } = await import('@/server/observability/logger')
  createLogger('api.map.features').info('map_features_response_sent', { feature_count: 25 })
  expect(requests).toHaveLength(0)
  expect(pending).toHaveLength(1)
  await pending[0]()
  expect(requests).toHaveLength(1)
  expect(requests[0].authorization).toBe('Bearer test-project-token')
  const payload = JSON.parse(requests[0].body)
  const record = payload.resourceLogs[0].scopeLogs[0].logRecords[0]
  expect(record.body).toEqual({ stringValue: 'map_features_response_sent' })
  expect(record.attributes).toContainEqual({ key: 'feature_count', value: { intValue: 25 } })
})

it('does not fail the response callback when the ingestion endpoint rejects the log', async () => {
  responseStatus = 400
  const { createLogger } = await import('@/server/observability/logger')
  createLogger('api.map.features').error('map_features_request_failed', { error_class: 'Error' })
  await expect(pending[0]()).resolves.toBeUndefined()
  expect(requests).toHaveLength(1)
})

it('skips delivery when PostHog is unconfigured', async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '')
  const { createLogger } = await import('@/server/observability/logger')
  const output = vi.spyOn(console, 'log').mockImplementation(() => {})
  expect(() => createLogger('api.map.features').info('map_features_response_sent')).not.toThrow()
  expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ message: 'map_features_response_sent' })
  expect(pending).toHaveLength(0)
  expect(requests).toHaveLength(0)
})

it.each([
  ['info', 'log', 9],
  ['warn', 'warn', 13],
  ['error', 'error', 17],
] as const)('delivers one protected %s event to console and OTLP', async (level, method, severity) => {
  const output = vi.spyOn(console, method).mockImplementation(() => {})
  const { createLogger } = await import('@/server/observability/logger')
  const fields = {
    feature_count: 25,
    email: 'fan@example.org',
    credential: 'Bearer private',
    nested: { token: 'private', profileId: '42', payload: { text: 'private' } },
    values: ['fan@example.org', 'safe'],
  }
  createLogger('api.map.features')[level]('map_features_result', fields)
  expect(output).toHaveBeenCalledTimes(1)
  expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({
    scope: 'api.map.features', message: 'map_features_result', level,
    feature_count: 25, email: '[REDACTED]', credential: '[REDACTED]',
    nested: { token: '[REDACTED]', profileId: '42', payload: '[REDACTED]' },
    values: ['[REDACTED]', 'safe'],
  })
  expect(pending).toHaveLength(1)
  expect(requests).toHaveLength(0)
  await pending[0]()
  expect(requests).toHaveLength(1)
  const record = JSON.parse(requests[0].body).resourceLogs[0].scopeLogs[0].logRecords[0]
  expect(record).toMatchObject({
    body: { stringValue: 'map_features_result' }, severityNumber: severity, severityText: level.toUpperCase(),
  })
  expect(record.attributes).toEqual(expect.arrayContaining([
    { key: 'scope', value: { stringValue: 'api.map.features' } },
    { key: 'feature_count', value: { intValue: 25 } },
    { key: 'email', value: { stringValue: '[REDACTED]' } },
    { key: 'credential', value: { stringValue: '[REDACTED]' } },
    { key: 'nested', value: { stringValue: '{"token":"[REDACTED]","profileId":"42","payload":"[REDACTED]"}' } },
    { key: 'values', value: { stringValue: '["[REDACTED]","safe"]' } },
  ]))
  expect(fields.email).toBe('fan@example.org')
  expect(fields.nested.token).toBe('private')
})

it('continues delivering to OTLP when the console transport throws', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => { throw new Error('console unavailable') })
  const { createLogger } = await import('@/server/observability/logger')
  expect(() => createLogger('test').info('ready')).not.toThrow()
  expect(pending).toHaveLength(1)
  await pending[0]()
  expect(requests).toHaveLength(1)
})

it('keeps console delivery when the OTLP configuration is invalid', async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'invalid URL')
  const output = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { createLogger } = await import('@/server/observability/logger')
  expect(() => createLogger('test').warn('ready')).not.toThrow()
  expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ message: 'ready' })
  expect(pending).toHaveLength(0)
})

it('keeps console delivery outside a Next.js request context', async () => {
  lifecycle.unavailable = true
  const output = vi.spyOn(console, 'log').mockImplementation(() => {})
  const { createLogger } = await import('@/server/observability/logger')
  expect(() => createLogger('test').info('ready')).not.toThrow()
  expect(output).toHaveBeenCalledTimes(1)
  expect(pending).toHaveLength(0)
})

it('flushes subsequent events from the same module graph', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const { createLogger } = await import('@/server/observability/logger')
  const logger = createLogger('test')
  logger.info('first')
  await pending[0]()
  logger.info('second')
  await pending[1]()
  expect(requests.map(({ body }) => JSON.parse(body).resourceLogs[0].scopeLogs[0].logRecords[0].body))
    .toEqual([{ stringValue: 'first' }, { stringValue: 'second' }])
})

it.each(['success', 'failure'] as const)('logs the map route %s once through each destination', async (outcome) => {
  const method = outcome === 'success' ? 'log' : 'error'
  const output = vi.spyOn(console, method).mockImplementation(() => {})
  const { createMapFeaturesGetHandler } = await import('@/app/api/map/features/route')
  const handler = createMapFeaturesGetHandler({
    getDatabase: () => ({} as never),
    list: async () => {
      if (outcome === 'failure') throw new Error('private database connection details')
      return []
    },
  })
  const response = await handler(new Request('http://localhost/api/map/features?west=-180&south=-90&east=180&north=90&zoom=5'))
  expect(response.status).toBe(outcome === 'success' ? 200 : 503)
  const message = outcome === 'success' ? 'map_features_response_sent' : 'map_features_request_failed'
  const fields = outcome === 'success' ? { feature_count: 0, result_truncated: false } : { error_class: 'Error' }
  expect(output).toHaveBeenCalledTimes(1)
  expect(JSON.parse(output.mock.calls[0][0])).toMatchObject({ scope: 'api.map.features', message, ...fields })
  expect(pending).toHaveLength(1)
  await pending[0]()
  expect(requests).toHaveLength(1)
  const records = JSON.parse(requests[0].body).resourceLogs[0].scopeLogs[0].logRecords
  expect(records).toHaveLength(1)
  expect(records[0].body).toEqual({ stringValue: message })
  expect(requests[0].body).not.toContain('private database connection details')
})
