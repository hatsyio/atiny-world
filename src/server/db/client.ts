import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

import { getDatabaseUrl } from '@/server/env'
import { createLogger } from '@/server/observability/logger'
import { createSql, type Sql } from './sql'

let database: Sql | undefined
const logger = createLogger('database')

export function isLocalDatabase(databaseUrl: string): boolean {
  return ['127.0.0.1', 'localhost', '[::1]', 'db'].includes(new URL(databaseUrl).hostname)
}

export function createDatabase(databaseUrl: string): { sql: Sql; pool: Pool } {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    pipeline: false,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocalDatabase(databaseUrl) ? false : { rejectUnauthorized: false },
    options: '-c search_path=extensions,public',
  })
  // pg removes the failed idle client itself; observe the event so it cannot crash the process.
  pool.on('error', () => logger.error('Database idle connection failed'))
  return { sql: createSql(pool), pool }
}

export function getDb(): Sql {
  if (!database) {
    const { sql, pool } = createDatabase(getDatabaseUrl())
    if (process.env.VERCEL === '1') attachDatabasePool(pool)
    database = sql
  }
  return database
}
