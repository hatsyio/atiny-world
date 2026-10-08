import { randomUUID } from 'node:crypto'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV) {
  throw new Error('Database isolation is only configured inside GitHub Actions')
}

const config = await readFile('supabase/config.toml', 'utf8')
if (!/^project_id\s*=\s*"[^"]+"/m.test(config) || !/\[db\][\s\S]*?^port\s*=\s*\d+/m.test(config)) {
  throw new Error('Missing Supabase project_id or db.port')
}

// Ask the OS for an available port instead of competing for the local default.
const reservation = createServer()
await new Promise((resolve, reject) => {
  reservation.once('error', reject)
  reservation.listen(0, '0.0.0.0', resolve)
})
const port = reservation.address().port
const projectId = `atiny-ci-${randomUUID()}`
try {
  let section = ''
  const isolatedConfig = config.split('\n').map(line => {
    const heading = line.match(/^\[([^\]]+)\]/)
    if (heading) section = heading[1]
    if (section === '' && /^project_id\s*=/.test(line)) return `project_id = "${projectId}"`
    if (section === 'db' && /^port\s*=/.test(line)) return `port = ${port}`
    return line
  }).join('\n')
  await writeFile('supabase/config.toml', isolatedConfig)
} finally {
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
}

const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`
await appendFile(process.env.GITHUB_ENV, `DATABASE_URL=${url}\nTEST_DATABASE_URL=${url}\nCI_SUPABASE_PROJECT_ID=${projectId}\n`)
console.log(`Configured isolated CI database ${projectId} on port ${port}`)
