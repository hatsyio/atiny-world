import type { Sql, TransactionSql } from 'postgres'

import { getDb } from './client'

export type TransactionCallback<T> = (sql: TransactionSql) => Promise<T>

export async function runInTransaction<T>(
  callback: TransactionCallback<T>,
  sql: Sql = getDb(),
): Promise<T> {
  return sql.begin(callback) as Promise<T>
}