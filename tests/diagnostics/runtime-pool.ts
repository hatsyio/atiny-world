// Read-only verification of the actual runtime adapter against shared Supavisor.
// pnpm exec tsx tests/diagnostics/runtime-pool.ts --env-file .env.pro --port 6543
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseArgs, parseEnv } from 'node:util'
import { createDatabase } from '../../src/server/db/client'

async function main() {
  const { values } = parseArgs({ options: {
    'env-file': { type: 'string' },
    port: { type: 'string', default: '6543' },
  } })
  assert(values['env-file'], 'An explicit --env-file is required')
  assert(['5432', '6543'].includes(values.port))
  const env = parseEnv(await readFile(values['env-file'], 'utf8'))
  assert(env.DATABASE_URL)
  const url = new URL(env.DATABASE_URL)
  assert(url.hostname.endsWith('.pooler.supabase.com'), 'Expected shared Supavisor endpoint')
  // Port override is diagnostic-only; production preserves DATABASE_URL verbatim.
  url.port = values.port
  const { sql, pool } = createDatabase(url.toString())
  const deadline = setTimeout(() => { console.error('Diagnostic deadline exceeded'); process.exit(1) }, 60_000)
  let completed = 0
  try {
    for (let round = 0; round < 5; round++) {
      await Promise.all(Array.from({ length: 18 }, async (_, index) => {
        const marker = `runtime-${round}-${index}`
        const payload = 'x'.repeat(8192)
        if (index % 3 === 0) {
          const rows = await sql<{ id: number }[]>`select id from app_private.settings where id = 1`
          assert.equal(rows[0].id, 1)
        } else if (index % 3 === 1) {
          const condition = sql`${marker}::text as marker, ${payload}::text as payload`
          const [row] = await sql<{ marker: string; payload: string; srid: number }[]>`
            select ${condition}, st_srid(st_setsrid(st_makepoint(0, 0), 4326)) as srid
          `
          assert.equal(row.marker, marker)
          assert.equal(row.payload, payload)
          assert.equal(row.srid, 4326)
        } else {
          const transaction = () => sql.begin(async tx => {
            await tx`set transaction read only`
            const [first] = await tx<{ marker: string; pid: number; read_only: string }[]>`
              select ${marker}::text as marker, pg_backend_pid() as pid,
                     current_setting('transaction_read_only') as read_only
            `
            const [second] = await tx<{ pid: number }[]>`select pg_backend_pid() as pid`
            assert.equal(first.marker, marker)
            assert.equal(first.read_only, 'on')
            assert.equal(first.pid, second.pid)
            if (index % 2) await tx`select 1 / 0`
          })
          if (index % 2) await assert.rejects(transaction(), error => (error as { code: string }).code === '22012')
          else await transaction()
        }
        completed++
      }))
    }
    assert.equal(pool.idleCount, 1)
    await new Promise(resolve => setTimeout(resolve, 21_500))
    assert.equal(pool.totalCount, 0)
    const [row] = await sql<{ value: number; search_path: string }[]>`
      select 1::int as value, current_setting('search_path') as search_path
    `
    assert.equal(row.value, 1)
    assert.equal(row.search_path.replaceAll(' ', ''), 'extensions,public')
    console.log(JSON.stringify({ port: values.port, completed, idleClosed: true, reconnected: true }))
  } finally {
    clearTimeout(deadline)
    await sql.end()
  }

}
main().catch(() => { console.error('Runtime pool diagnostic failed; no credentials are printed'); process.exitCode = 1 })
