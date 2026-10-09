import { describe, expect, it, vi } from 'vitest'
import { createSql } from '@/server/db/sql'

function fixture() {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
  const pool = { query: vi.fn().mockResolvedValue({ rows: [{ value: 'ok' }] }), connect: vi.fn().mockResolvedValue(client), end: vi.fn().mockResolvedValue(undefined) }
  return { pool, client, sql: createSql(pool) }
}

describe('parameterized SQL over pg', () => {
  it('composes lazy fragments and binds hostile input without executing fragments', async () => {
    const { pool, sql } = fixture()
    const input = "'); drop table profiles; --"
    const where = sql`name = ${input} and id = ${42}`
    expect(pool.query).not.toHaveBeenCalled()
    const query = sql`select ${7} as value where ${where}`
    expect(await query).toEqual([{ value: 'ok' }])
    await query
    expect(pool.query).toHaveBeenCalledTimes(1)
    expect(pool.query).toHaveBeenCalledWith({ text: 'select $1 as value where name = $2 and id = $3', values: [7, input, 42] })
  })

  it('pins BEGIN, queries and COMMIT to one client and releases it', async () => {
    const { sql, pool, client } = fixture()
    await sql.begin(async tx => { await tx`select ${1}`; await tx`select ${2}` })
    expect(pool.query).not.toHaveBeenCalled()
    expect(client.query.mock.calls.map(call => call[0])).toEqual(['BEGIN', { text: 'select $1', values: [1] }, { text: 'select $1', values: [2] }, 'COMMIT'])
    expect(client.release).toHaveBeenCalledWith(undefined)
  })

  it('rolls back and releases the client when a transaction fails', async () => {
    const { sql, client } = fixture()
    const error = new Error('abort')
    await expect(sql.begin(async tx => { await tx`select ${1}`; throw error })).rejects.toBe(error)
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledWith(undefined)
  })

  it('discards a client whose rollback fails while preserving the original error', async () => {
    const { sql, client } = fixture()
    const error = new Error('abort')
    client.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('connection lost'))
    await expect(sql.begin(async () => { throw error })).rejects.toBe(error)
    expect(client.release).toHaveBeenCalledWith(true)
  })

  it('rejects a COMMIT that PostgreSQL turned into ROLLBACK after a caught SQL error', async () => {
    const { sql, client } = fixture()
    client.query.mockResolvedValueOnce({ rows: [], command: 'BEGIN' })
      .mockRejectedValueOnce(new Error('SQL error'))
      .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK' })
    await expect(sql.begin(async tx => {
      try { await tx`select 1 / 0` } catch { /* The database transaction remains aborted. */ }
    })).rejects.toThrow('Transaction aborted before commit')
    expect(client.release).toHaveBeenCalledWith(undefined)
  })

  it('rejects undefined values and serializes JSON as a bound parameter', async () => {
    const { sql, pool } = fixture()
    expect(() => sql`select ${undefined}`).toThrow('Undefined SQL parameter')
    await sql`select ${sql.json({ action: 'approve' })}::jsonb`
    expect(pool.query).toHaveBeenCalledWith({ text: 'select $1::jsonb', values: ['{"action":"approve"}'] })
  })
})
