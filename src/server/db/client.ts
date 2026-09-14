import postgres, { type Sql } from "postgres"

import { getDatabaseUrl } from "@/server/env"

let database: Sql | undefined

export function isLocalDatabase(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname

  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname === "db"
  )
}

export function getDb(): Sql {
  if (!database) {
    const databaseUrl = getDatabaseUrl()

    database = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      ssl: isLocalDatabase(databaseUrl) ? false : "require",
    })
  }

  return database
}
