const DETERMINISTIC_SECRET_KEYS = [
  'CLERK_SECRET_KEY',
  'GEOAPIFY_API_KEY',
  'CLERK_WEBHOOK_SECRET',
  'CRON_SECRET',
  'LOCATION_SELECTION_SECRET',
  'CURSOR_SECRET',
  'NEXT_PUBLIC_CARTO_BASEMAP_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
] as const

const deterministicDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export const deterministicEnvironment: Record<string, string | undefined> = {
  DATABASE_URL: deterministicDatabaseUrl,
  ...Object.fromEntries(
    DETERMINISTIC_SECRET_KEYS.map((key) => [key, undefined]),
  ),
}

export function applyDeterministicTestEnvironment(): () => void {
  const previous = { ...process.env }

  for (const key of DETERMINISTIC_SECRET_KEYS) {
    delete process.env[key]
  }
  process.env.DATABASE_URL = deterministicDatabaseUrl

  return () => {
    process.env = previous
  }
}

applyDeterministicTestEnvironment()