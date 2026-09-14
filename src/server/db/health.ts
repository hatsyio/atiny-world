import { getDb } from '@/server/db/client'

export type DatabaseHealth = {
  database: 'ok'
}

export type DatabaseQuery = (query: string) => Promise<readonly unknown[]>

async function queryDatabase(query: string): Promise<readonly unknown[]> {
  return getDb().unsafe(query)
}

export async function checkDatabaseHealth(
  query: DatabaseQuery = queryDatabase,
): Promise<DatabaseHealth> {
  const rows = await query('select 1 as ok')

  if (rows.length === 0) {
    throw new Error('Database health probe returned no rows')
  }

  return { database: 'ok' }
}
