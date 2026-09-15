export type LogLevel = 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export type LogSink = (level: LogLevel, scope: string, message: string, fields: LogFields) => void

export interface Logger {
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
}

export class LogRedactionError extends Error {
  constructor(key: string, value: unknown) {
    super(`refusing to log sensitive field "${key}"`)
    this.name = 'LogRedactionError'
    this.valueKind = value === null ? 'null' : typeof value
  }

  valueKind: string
}

const RESERVED_KEY_PATTERN =
  /^(email|address|query|content|messageText|evidence|payload|note|reason|body|authorization|cookie|password|token|secret|apiKey|providerResponse|raw)$/i

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const SECRET_PATTERN = /(^(sk|pk|whsec)_|^(eyJ|ghp_|Bearer\s))/i

export function isLogSafeValue(value: unknown): boolean {
  if (typeof value !== 'string') return true
  return !EMAIL_PATTERN.test(value) && !SECRET_PATTERN.test(value)
}

function leafKey(dottedPath: string): string {
  const idx = dottedPath.lastIndexOf('.')
  return idx === -1 ? dottedPath : dottedPath.slice(idx + 1)
}

function redactField(path: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => redactField(`${path}.${index}`, entry))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        redactField(`${path}.${key}`, nestedValue),
      ]),
    )
  }

  const key = leafKey(path)
  if (RESERVED_KEY_PATTERN.test(key) || !isLogSafeValue(value)) return '[REDACTED]'
  return value
}

export function redactLogFields(fields: LogFields, throwOnSensitiveKey = false): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (RESERVED_KEY_PATTERN.test(key)) {
        if (throwOnSensitiveKey) throw new LogRedactionError(key, value)
        return [key, '[REDACTED]']
      }
      if (!isLogSafeValue(value)) {
        if (throwOnSensitiveKey) throw new LogRedactionError(key, value)
        return [key, '[REDACTED]']
      }
      return [key, redactField(key, value)]
    }),
  )
}

export function createLogger(
  scope: string,
  sink: LogSink = defaultSink,
): Logger {
  const write = (level: LogLevel, message: string, fields: LogFields = {}) => {
    sink(level, scope, message, redactLogFields(fields))
  }

  return {
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  }
}

function defaultSink(level: LogLevel, scope: string, message: string, fields: LogFields): void {
  if (level === 'error') {
    console.error(jsonLine(scope, message, fields))
  } else if (level === 'warn') {
    console.warn(jsonLine(scope, message, fields))
  } else {
    console.log(jsonLine(scope, message, fields))
  }
}

function jsonLine(scope: string, message: string, fields: LogFields): string {
  return JSON.stringify({ time: new Date().toISOString(), scope, message, ...fields })
}