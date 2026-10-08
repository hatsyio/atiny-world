import postgres, { type Sql } from 'postgres'

import { getDatabaseUrl } from '@/server/env'

let database: Sql | undefined

export function isLocalDatabase(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname

  return (
    hostname === '127.0.0.1' ||
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    hostname === 'db'
  )
}

export function getDb(): Sql {
  if (!database) {
    const databaseUrl = getDatabaseUrl()
    const runtimeUrl = new URL(databaseUrl)
    // Shared Supabase session pools reserve a backend per Vercel instance.
    // Only runtime clients switch modes; migration scripts use their own URLs.
    if (
      process.env.VERCEL === '1' &&
      runtimeUrl.hostname.endsWith('.pooler.supabase.com') &&
      (!runtimeUrl.port || runtimeUrl.port === '5432')
    ) {
      runtimeUrl.port = '6543'
    }

    database = postgres(runtimeUrl.toString(), {
      max: 1,
      idle_timeout: 20,
      prepare: false,
      ssl: isLocalDatabase(databaseUrl) ? false : 'require',
      connection: { options: '-c search_path=extensions,public' },
    })
  }

  return database
}
