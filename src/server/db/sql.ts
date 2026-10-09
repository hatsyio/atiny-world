import { Sql as Template } from 'sql-template-tag'

/** The application uses tagged parameters, lazy fragments and explicit transactions. */
export type Fragment = Template
export interface TransactionSql {
  <T extends unknown[] = Record<string, unknown>[]>(strings: TemplateStringsArray, ...values: unknown[]): PromiseLike<T> & Fragment
  unsafe<T extends unknown[] = Record<string, unknown>[]>(text: string): PromiseLike<T>
  json(value: unknown): string
}
export interface Sql extends TransactionSql {
  begin<T>(callback: (tx: TransactionSql) => T | PromiseLike<T>): Promise<T>
  end(): Promise<void>
}

interface Executor {
  query(query: string | { text: string; values: unknown[] }): Promise<{ rows: unknown[]; command?: string }>
}
interface PoolLike extends Executor {
  connect(): Promise<Executor & { release(destroy?: boolean): void }>
  end(): Promise<void>
}

class Query<T extends unknown[]> extends Template implements PromiseLike<T> {
  private result?: Promise<T>

  constructor(strings: readonly string[], values: unknown[], private readonly executor: Executor) {
    if (values.some(value => value === undefined)) throw new Error('Undefined SQL parameter')
    super(strings, values)
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.result ??= this.executor.query({ text: this.text, values: this.values }).then(result => result.rows as T)
    return this.result.then(onfulfilled, onrejected)
  }
}

function createTag(executor: Executor): TransactionSql {
  const tag = <T extends unknown[]>(strings: TemplateStringsArray, ...values: unknown[]) => new Query<T>(strings, values, executor)
  return Object.assign(tag, {
    unsafe: <T extends unknown[]>(text: string) => new Query<T>([text], [], executor),
    json: (value: unknown) => JSON.stringify(value),
  })
}

export function createSql(pool: PoolLike): Sql {
  return Object.assign(createTag(pool), {
    async begin<T>(callback: (tx: TransactionSql) => T | PromiseLike<T>): Promise<T> {
      const client = await pool.connect()
      let destroy: boolean | undefined
      try {
        await client.query('BEGIN')
        const result = await callback(createTag(client))
        const committed = await client.query('COMMIT')
        if (committed.command === 'ROLLBACK') throw new Error('Transaction aborted before commit')
        return result
      } catch (error) {
        try { await client.query('ROLLBACK') } catch { destroy = true }
        throw error
      } finally {
        client.release(destroy)
      }
    },
    end: () => pool.end(),
  })
}
