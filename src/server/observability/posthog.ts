import { headers } from 'next/headers'
import { after } from 'next/server'
import type { Instrumentation } from 'next'
import { PostHog } from 'posthog-node'

let client: PostHog | null | undefined

function reportMissingConfiguration(variableName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.error(
      new Error(
        `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
      ),
    )
  }
}

function getPostHogClient(): PostHog | null {
  if (client !== undefined) return client

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!projectToken) reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN')
  if (!host) reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_HOST')

  client = projectToken && host
    ? new PostHog(projectToken, {
        host,
        enableExceptionAutocapture: false,
        flushAt: 100,
        flushInterval: 0,
        requestTimeout: 3000,
        fetchRetryCount: 0,
      })
    : null

  return client
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, boolean | number | string>,
) {
  try {
    const posthog = getPostHogClient()
    if (!posthog) return
    const sessionId = (await headers()).get('x-posthog-session-id')
    const eventProperties = sessionId ? { ...properties, $session_id: sessionId } : properties
    posthog.capture({ distinctId, event, properties: eventProperties })
    after(async () => {
      try { await posthog.flush() } catch { /* Telemetry must not affect application requests. */ }
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error(error)
  }
}

export const captureServerRequestError: Instrumentation.onRequestError = (error, request, context) => {
  try {
    const posthog = getPostHogClient()
    if (!posthog) return
    posthog.captureException(error, undefined, {
      $pathname: request.path.split(/[?#]/)[0],
      request_method: request.method,
      route: context.routePath,
      route_type: context.routeType,
    })
    after(async () => {
      try { await posthog.flush() } catch { /* Keep the original error response. */ }
    })
  } catch { /* Reporting failures must not replace the original error. */ }
}
