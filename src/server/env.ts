import { z } from 'zod'

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  GEOAPIFY_API_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  LOCATION_SELECTION_SECRET: z.string().min(1).optional(),
  CURSOR_SECRET: z.string().min(1).optional(),
})

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_CARTO_BASEMAP_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>
export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>

export type ServerEnvironmentSource = Record<
  string,
  string | undefined
>

function parseServerEnvironment(
  environment: ServerEnvironmentSource,
): ServerEnvironment {
  const parsed = serverEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new Error(
      `Server environment is invalid: ${firstIssue?.path.join('.') ?? 'unknown'} ${firstIssue?.message ?? 'failed validation'}`,
    )
  }

  return parsed.data
}

export function getServerEnvironment(
  environment: ServerEnvironmentSource = process.env,
): ServerEnvironment {
  return parseServerEnvironment(environment)
}

function requireEnvironmentValue(
  environment: ServerEnvironmentSource,
  key: keyof ServerEnvironment,
  description: string,
): string {
  const value = environment[key]

  if (!value) {
    throw new Error(`${key} is required on the server for ${description}`)
  }

  return value
}

export function getDatabaseUrl(
  environment?: ServerEnvironmentSource,
): string {
  const source = environment ?? process.env
  return requireEnvironmentValue(source, 'DATABASE_URL', 'database access')
}

export function getGeoapifyApiKey(
  environment: ServerEnvironmentSource = process.env,
): string {
  return requireEnvironmentValue(environment, 'GEOAPIFY_API_KEY', 'location suggestions')
}

export function getClerkWebhookSecret(
  environment: ServerEnvironmentSource = process.env,
): string {
  return requireEnvironmentValue(
    environment,
    'CLERK_WEBHOOK_SECRET',
    'signed Clerk webhook verification',
  )
}

export function getCronSecret(
  environment: ServerEnvironmentSource = process.env,
): string {
  return requireEnvironmentValue(
    environment,
    'CRON_SECRET',
    'the production account-deletion retry endpoint',
  )
}

export function getLocationSelectionSecret(
  environment: ServerEnvironmentSource = process.env,
): string {
  return requireEnvironmentValue(
    environment,
    'LOCATION_SELECTION_SECRET',
    'signing location-selection tokens',
  )
}

export function getCartoBasemapKey(
  environment: Record<string, string | undefined> = process.env,
): string {
  const value = environment.NEXT_PUBLIC_CARTO_BASEMAP_KEY

  if (!value) {
    throw new Error(
      'NEXT_PUBLIC_CARTO_BASEMAP_KEY is required for the public map',
    )
  }

  return value
}

export function parseClientEnvironment(
  environment: Record<string, string | undefined>,
): ClientEnvironment {
  const parsed = clientEnvironmentSchema.safeParse(environment)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new Error(
      `Client environment is invalid: ${firstIssue?.path.join('.') ?? 'unknown'} ${firstIssue?.message ?? 'failed validation'}`,
    )
  }

  return parsed.data
}