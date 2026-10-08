import { after } from 'next/server'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'

import type { LogFields, LogSink } from './logger'

type LogAttributes = Record<string, boolean | number | string>

let loggerProvider: LoggerProvider | null | undefined
let logEmitter: ReturnType<LoggerProvider['getLogger']> | null = null

function reportMissingConfiguration(variableName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.error(
      new Error(
        `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
      ),
    )
  }
}

function registerPostHogLogExporter() {
  if (loggerProvider !== undefined) return

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!projectToken) reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN')
  if (!host) reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_HOST')

  if (!projectToken || !host) {
    loggerProvider = null
    return
  }

  const exporter = new OTLPLogExporter({
    timeoutMillis: 3000,
    url: new URL('i/v1/logs', `${host}/`).toString(),
    headers: { Authorization: `Bearer ${projectToken}` },
  })
  loggerProvider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor({ exporter, exportTimeoutMillis: 3000 })],
  })
  logEmitter = loggerProvider.getLogger('posthog.exporter')
}

// This adapter receives fields already protected by the common logging policy.
function toAttributes(fields: LogFields): LogAttributes {
  const attributes: LogAttributes = {}
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      attributes[key] = value
    } else if (value !== null && typeof value === 'object') {
      attributes[key] = JSON.stringify(value)
    }
  }
  return attributes
}

export const postHogLogSink: LogSink = (level, scope, body, fields) => {
  try {
    // Instrumentation and routes can run in separate Next.js module graphs.
    // Initialize in the graph that emits the log, before reading its state.
    registerPostHogLogExporter()
    if (!loggerProvider || !logEmitter) return
    const provider = loggerProvider
    const emitter = logEmitter
    const attributes = { ...toAttributes(fields), scope }

    after(async () => {
      try {
        emitter.emit({
          severityNumber: level === 'error'
            ? SeverityNumber.ERROR
            : level === 'warn'
              ? SeverityNumber.WARN
              : SeverityNumber.INFO,
          severityText: level.toUpperCase(),
          body,
          attributes,
        })
        await provider.forceFlush()
      } catch { /* Export failures must not affect the application. */ }
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error(error)
  }
}
