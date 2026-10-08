import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'

const run = promisify(execFile)
const script = resolve('scripts/configure-ci-database.mjs')
const fixtures: string[] = []
afterEach(async () => { await Promise.all(fixtures.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function fixture(port: number) {
  const cwd = await mkdtemp(join(tmpdir(), 'atiny-ci-db-'))
  fixtures.push(cwd)
  await mkdir(join(cwd, 'supabase'))
  const config = `project_id = "atiny-world"\n[api]\nport = 54321\n[db]\n# Local database\nport = ${port}\nshadow_port = 54320\n[db.pooler]\nport = 54329\n`
  await writeFile(join(cwd, 'supabase/config.toml'), config)
  const envFile = join(cwd, 'github-env')
  return { cwd, config, envFile, env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_ENV: envFile } }
}

it('selects a free database port and exports the same URL to application and tests', async () => {
  const occupied = createServer()
  await new Promise<void>(resolve => occupied.listen(0, '0.0.0.0', resolve))
  const occupiedPort = (occupied.address() as { port: number }).port
  try {
    const input = await fixture(occupiedPort)
    await run(process.execPath, [script], input)
    const env = Object.fromEntries((await readFile(input.envFile, 'utf8')).trim().split('\n').map(line => line.split('=')))
    const url = new URL(env.DATABASE_URL)
    expect(Number(url.port)).not.toBe(occupiedPort)
    expect(env.TEST_DATABASE_URL).toBe(env.DATABASE_URL)
    const config = await readFile(join(input.cwd, 'supabase/config.toml'), 'utf8')
    expect(config).toContain(`[db]\n# Local database\nport = ${url.port}\nshadow_port = 54320`)
    expect(config).toContain('[api]\nport = 54321')
    expect(config).toContain('[db.pooler]\nport = 54329')
    expect(config).toContain(`project_id = "${env.CI_SUPABASE_PROJECT_ID}"`)
  } finally {
    await new Promise<void>((resolve, reject) => occupied.close(error => error ? reject(error) : resolve()))
  }
})

it('gives concurrent jobs different container and volume namespaces', async () => {
  const inputs = await Promise.all([fixture(54322), fixture(54322)])
  await Promise.all(inputs.map(input => run(process.execPath, [script], input)))
  const envs = await Promise.all(inputs.map(input => readFile(input.envFile, 'utf8')))
  const ids = envs.map(env => env.match(/^CI_SUPABASE_PROJECT_ID=(.+)$/m)?.[1])
  expect(ids[0]).not.toBe('atiny-world')
  expect(ids[0]).not.toBe(ids[1])
})

it('refuses to modify developer configuration outside GitHub Actions', async () => {
  const input = await fixture(54322)
  await expect(run(process.execPath, [script], { ...input, env: { ...input.env, GITHUB_ACTIONS: 'false' } })).rejects.toThrow('only configured inside GitHub Actions')
  expect(await readFile(join(input.cwd, 'supabase/config.toml'), 'utf8')).toBe(input.config)
})
