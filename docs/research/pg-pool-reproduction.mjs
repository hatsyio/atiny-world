// Read-only comparison of the previous Postgres.js driver and pg.
// --pg-dir optionally selects an isolated installation; otherwise use installed pg.
// Port overrides are diagnostic-only, never production routing.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import postgres from 'postgres'

const { values } = parseArgs({ options: {
  'pg-dir': { type: 'string' },
  driver: { type: 'string', default: 'pg' },
  'env-file': { type: 'string', default: '.env.pro' },
  port: { type: 'string', default: '6543' },
  max: { type: 'string', default: '1' },
  rounds: { type: 'string', default: '5' },
} })
assert(['pg', 'postgres'].includes(values.driver))
let version
let Pool
if (values.driver === 'pg') {
  const requirePg = createRequire(values['pg-dir'] ? resolve(values['pg-dir'], 'package.json') : import.meta.url)
  Pool = requirePg('pg').Pool
  version = requirePg('pg/package.json').version
} else {
  // The postgres exports map hides package.json. Locate it beside the ESM entry.
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.resolve('postgres')), 'utf8'))
  version = manifest.version
}
const env = parseEnv(await readFile(values['env-file'], 'utf8'))
assert(env.DATABASE_URL, 'DATABASE_URL is required')
const url = new URL(env.DATABASE_URL)
assert(url.hostname.endsWith('.pooler.supabase.com'), 'Expected shared Supabase pooler')
assert(['5432', '6543'].includes(values.port), 'Expected session or transaction port')
url.port = values.port
const max = Number(values.max)
const rounds = Number(values.rounds)
assert([1, 3].includes(max), 'Pool size must be 1 or 3 for this bounded diagnostic')
assert(Number.isInteger(rounds) && rounds >= 1 && rounds <= 10)

// SSL matches the existing Postgres.js ssl: require diagnostic baseline.
// No named statements; pipeline is explicitly off. Only SELECT statements;
// explicit transactions use BEGIN READ ONLY (startup read-only options are
// not reliably forwarded by the shared pooler).
const pool = values.driver === 'pg' ? new Pool({
  connectionString: url.toString(), max, pipeline: false,
  ssl: { rejectUnauthorized: false },
  application_name: 'atiny-pg-readonly-diagnostic',
  options: '-c search_path=extensions,public',
  connectionTimeoutMillis: 5000, query_timeout: 5000,
  idleTimeoutMillis: 20000,
}) : undefined
const sql = values.driver === 'postgres' ? postgres(url.toString(), {
  max, idle_timeout: 20, prepare: false, ssl: 'require',
  connection: { options: '-c search_path=extensions,public' },
}) : undefined
// Native transaction APIs are kept: sql.begin for the existing application,
// one checked-out pg client with BEGIN/COMMIT/ROLLBACK for the candidate.
const query = (text, parameters = []) => pool
  ? pool.query(text, parameters).then(result => result.rows)
  : sql.unsafe(text, parameters)
const close = () => pool ? pool.end() : sql.end({ timeout: 1 })
let idleErrors = 0
pool?.on('error', () => { idleErrors++ })
const deadline = setTimeout(() => {
  console.error(JSON.stringify({ result: 'diagnostic_deadline', driver: values.driver }))
  process.exit(1)
}, 60000)

async function bounded(work, milliseconds = 10000) {
  let timer
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Round deadline'), { code: 'ROUND_DEADLINE' })), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

function checkRow(row, marker, payload = '', transactionReadOnly = false) {
  assert.equal(row.marker, marker)
  assert.equal(row.payload, payload)
  if (transactionReadOnly) assert.equal(row.read_only, 'on')
  assert.equal(row.search_path.replaceAll(' ', ''), 'extensions,public')
  assert.equal(row.srid, 4326)
}
const fields = "current_setting('transaction_read_only') as read_only, current_setting('search_path') as search_path, st_srid(st_setsrid(st_makepoint(0,0),4326)) as srid"

async function transaction(marker, rollback = false) {
  const body = async txQuery => {
    const first = await txQuery(`select $1::text as marker, ''::text as payload, ${fields}, pg_backend_pid() as pid`, [marker])
    checkRow(first[0], marker, '', true)
    const next = await txQuery(`select $1::text as marker, ''::text as payload, ${fields}, pg_backend_pid() as pid`, [marker + '-second'])
    checkRow(next[0], marker + '-second', '', true)
    assert.equal(first[0].pid, next[0].pid)
    // Propagate the expected SQL error so each driver's native transaction
    // implementation must roll back before another operation can use it.
    if (rollback) await txQuery('select 1 / 0')
  }
  const work = async () => {
    if (sql) return sql.begin('read only', tx => body((text, params = []) => tx.unsafe(text, params)))
    const client = await pool.connect()
    let destroy = false
    try {
      await client.query('begin read only')
      await body((text, params = []) => client.query(text, params).then(result => result.rows))
      await client.query('commit')
    } catch (error) {
      await client.query('rollback').catch(() => { destroy = true })
      throw error
    } finally { client.release(destroy) }
  }
  if (rollback) await assert.rejects(work(), error => error.code === '22012')
  else await work()
}

let operations = 0
const completed = []
let failed = false
try {
  for (let round = 0; round < rounds; round++) {
    const started = performance.now()
    await bounded(Promise.all(Array.from({ length: 18 }, async (_, index) => {
      const marker = `round-${round}-query-${index}`
      if (index % 3 === 2) {
        await transaction(marker, index % 2 === 0)
      } else if (index % 3 === 0) {
        const rows = await query(`select '${marker}'::text as marker, ''::text as payload, ${fields}`)
        checkRow(rows[0], marker)
      } else {
        const payload = index % 2 ? 'x'.repeat(8192) : ''
        const rows = await query(`select $1::text as marker, $2::text as payload, ${fields}`, [marker, payload])
        checkRow(rows[0], marker, payload)
      }
      completed.push(marker)
      operations++
    })))
    if (pool) assert.equal(pool.waitingCount, 0)
    console.log(JSON.stringify({ driver: values.driver, version, port: values.port, max, round, operations: 18, result: 'ok', ms: Math.round(performance.now() - started) }))
  }
  const rows = await bounded(query('select id from app_private.settings where id = 1'))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 1)
  await bounded(query('select pg_sleep(0.05)'))
  assert.equal(idleErrors, 0)
  // Instrument local client lifecycle; backend PID can remain unchanged in
  // transaction pooling even when the application's TCP socket is new.
  let disconnected = false
  if (pool) pool.on('remove', () => { disconnected = true })
  else sql.options.onclose = () => { disconnected = true }
  await new Promise(resolve => setTimeout(resolve, 21500))
  if (pool) assert.equal(pool.totalCount, 0, 'Idle clients should close')
  assert(disconnected, 'Expected an idle client disconnect')
  checkRow((await bounded(query(`select 'reconnected'::text as marker, ''::text as payload, ${fields}`)))[0], 'reconnected')
  console.log(JSON.stringify({ result: 'passed', driver: values.driver, version, port: values.port, max, rounds, operations, checks: ['result_identity', 'parameter_types', 'payload_8192_bytes', 'readonly_transactions', 'search_path', 'postgis', 'transaction_backend_affinity', 'commit', 'error_rollback', 'settings_access', 'idle_close_20s', 'reconnect'] }))
} catch (error) {
  failed = true
  console.error(JSON.stringify({ result: 'failed', driver: values.driver, version, port: values.port, max, code: error.code ?? error.name, operations, completed, ...(error.code === 'ERR_ASSERTION' ? { actual: error.actual, expected: error.expected } : {}) }))
} finally {
  await bounded(close(), 2000).catch(() => {})
  clearTimeout(deadline)
  if (failed) process.exit(1)
}
