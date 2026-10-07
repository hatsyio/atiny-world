import posthog from 'posthog-js'

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

function reportMissingConfiguration(variableName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.error(
      new Error(
        `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
      ),
    )
  }
}

if (!projectToken) {
  reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN')
}

if (!host) {
  reportMissingConfiguration('NEXT_PUBLIC_POSTHOG_HOST')
}

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    tracing_headers: [window.location.hostname],
    defaults: '2026-01-30',
    capture_exceptions: true,
    autocapture: false,
    disable_session_recording: true,
    debug: process.env.NODE_ENV === 'development',
  })
}
