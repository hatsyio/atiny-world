import type { Instrumentation } from 'next'
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateRuntimeEnvironment } = await import('./server/env')
    validateRuntimeEnvironment()
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { captureServerRequestError } = await import('./server/observability/posthog')
  await captureServerRequestError(error, request, context)
}
