// @vitest-environment node
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const pending = vi.hoisted(() => [] as Array<() => Promise<void>>)
vi.mock('next/server', () => ({ after: (work: () => Promise<void>) => pending.push(work) }))

let server: Server
let requests: Array<{ authorization: string | undefined; body: string }>
let responseStatus: number

beforeEach(async () => {
  vi.resetModules()
  pending.length = 0
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
  vi.unstubAllEnvs()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

it('delivers OTLP logs after the response without a prior instrumentation registration', async () => {
  const { logPostHogExport } = await import('@/server/observability/posthog-logs')
  await logPostHogExport('info', 'map_features_response_sent', { feature_count: 25 })
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
  const { logPostHogExport } = await import('@/server/observability/posthog-logs')
  await logPostHogExport('error', 'map_features_request_failed', { error_class: 'Error' })
  await expect(pending[0]()).resolves.toBeUndefined()
  expect(requests).toHaveLength(1)
})

it('skips delivery when PostHog is unconfigured', async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '')
  const { logPostHogExport } = await import('@/server/observability/posthog-logs')
  await expect(logPostHogExport('info', 'map_features_response_sent', {})).resolves.toBeUndefined()
  expect(pending).toHaveLength(0)
  expect(requests).toHaveLength(0)
})
