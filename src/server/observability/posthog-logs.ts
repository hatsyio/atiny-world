import { after } from 'next/server'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'

type LogAttributes = Record<string, boolean | number | string>
type LogLevel = 'error' | 'info' | 'warn'

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

export function registerPostHogLogExporter() {
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
    processors: [new SimpleLogRecordProcessor({ exporter })],
  })
  logEmitter = loggerProvider.getLogger('posthog.exporter')
}

export async function logPostHogExport(
  level: LogLevel,
  body: string,
  attributes: LogAttributes,
) {
  if (!loggerProvider || !logEmitter) return
  const provider = loggerProvider
  const emitter = logEmitter

  try {
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
