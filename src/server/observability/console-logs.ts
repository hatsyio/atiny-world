import type { LogSink } from './logger'

export const consoleLogSink: LogSink = (level, scope, message, fields) => {
  const line = JSON.stringify({ ...fields, time: new Date().toISOString(), level, scope, message })
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}
