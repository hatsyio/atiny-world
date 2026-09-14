type DatabaseEnvironment = {
  DATABASE_URL?: string
}

export function getDatabaseUrl(
  environment?: DatabaseEnvironment,
): string {
  const databaseUrl =
    environment === undefined
      ? process.env.DATABASE_URL
      : environment.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required on the server")
  }

  return databaseUrl
}
