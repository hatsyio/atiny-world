import { spawn } from 'node:child_process'

import postgres from 'postgres'

const command = process.argv.slice(2)
if (command.length === 0) {
  console.error('Usage: node scripts/run-db-suite.mjs <test command> [args...]')
  process.exit(2)
}

const databaseUrl = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const sql = postgres(databaseUrl, { max: 1, prepare: false })

function runSuite() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', ...command], { stdio: 'inherit' })
    const forwardInterrupt = () => child.kill('SIGINT')
    const forwardTermination = () => child.kill('SIGTERM')
    process.on('SIGINT', forwardInterrupt)
    process.on('SIGTERM', forwardTermination)

    function finish() {
      process.off('SIGINT', forwardInterrupt)
      process.off('SIGTERM', forwardTermination)
    }

    child.once('error', (error) => {
      finish()
      reject(error)
    })
    child.once('exit', (code, signal) => {
      finish()
      resolve(code ?? (signal === 'SIGINT' ? 130 : 143))
    })
  })
}

try {
  process.stdout.write('Acquiring local test database lock…\n')
  const exitCode = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(4811, 20260921)`
    process.stdout.write('Local test database lock acquired.\n')
    return runSuite()
  })
  process.exitCode = exitCode
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await sql.end()
}
