import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createClerkClient } from '@clerk/nextjs/server'
import postgres from 'postgres'
import { bootstrapOwner } from '../src/server/moderation/bootstrap-owner'

async function main() {
  const args = process.argv.slice(2)
  const environment = args[0]
  const email = args[1]?.trim().toLowerCase()
  const remoteDevelopment = args.includes('--remote-db')
  if (!['dev', 'pro'].includes(environment) || !email?.includes('@') || args.slice(2).some(arg => !['--apply', '--remote-db'].includes(arg)) || (remoteDevelopment && environment !== 'dev')) {
    throw new Error('Usage: pnpm exec tsx scripts/bootstrap-owner.ts <dev|pro> <email> [--apply] [--remote-db (dev only)]')
  }
  const local = parseEnv(readFileSync('.env', 'utf8'))
  const env = environment === 'pro'
    ? { ...local, ...parseEnv(readFileSync('.env.pro', 'utf8')), ...parseEnv(readFileSync('.env.clerk-production.local', 'utf8')) }
    : remoteDevelopment ? { ...local, ...parseEnv(readFileSync('.env.pro', 'utf8')) } : local
  const secretKey = env.CLERK_SECRET_KEY
  if (!secretKey?.startsWith(environment === 'pro' ? 'sk_live_' : 'sk_test_')) throw new Error('Clerk key does not match the selected environment')
  const connectionString = env.DATABASE_URL
  if (!connectionString) throw new Error('Database URL is missing')
  const databaseUrl = new URL(connectionString)
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)
  if ((environment === 'pro' || remoteDevelopment) && isLocal) throw new Error('Remote provisioning must use the remote database')
  const clerk = createClerkClient({ secretKey })
  const users = await clerk.users.getUserList({ emailAddress: [email], limit: 10 })
  const matches = users.data.filter(user => user.emailAddresses.some(address => address.emailAddress.toLowerCase() === email && address.verification?.status === 'verified'))
  if (users.totalCount !== 1 || matches.length !== 1) throw new Error('Expected exactly one Clerk account with this verified email')
  const user = matches[0]
  if (user.banned || user.locked || !user.username) throw new Error('Clerk account must be available and have a username')
  // Preview/development and production share this database. Permit the other
  // instance's identity only after independently verifying the same email.
  let verifiedOtherInstanceUserId: string | undefined
  if (!isLocal) {
    const otherKey = environment === 'pro' ? local.CLERK_SECRET_KEY : parseEnv(readFileSync('.env.clerk-production.local', 'utf8')).CLERK_SECRET_KEY
    if (!otherKey?.startsWith(environment === 'pro' ? 'sk_test_' : 'sk_live_')) throw new Error('Other Clerk instance key is missing')
    const other = await createClerkClient({ secretKey: otherKey }).users.getUserList({ emailAddress: [email], limit: 10 })
    const otherUser = other.data[0]
    if (other.totalCount === 1 && otherUser && !otherUser.banned && !otherUser.locked && otherUser.emailAddresses.some(address => address.emailAddress.toLowerCase() === email && address.verification?.status === 'verified')) verifiedOtherInstanceUserId = otherUser.id
  }
  console.log(JSON.stringify({ environment, clerkUserId: user.id, username: user.username, databaseHost: databaseUrl.hostname, apply: args.includes('--apply') }))
  if (!args.includes('--apply')) return
  const sql = postgres(connectionString, { max: 1, prepare: false, ssl: isLocal ? false : 'require' })
  try { console.log(JSON.stringify(await bootstrapOwner(sql, { clerkUserId: user.id, displayName: user.username, verifiedOtherInstanceUserId }))) }
  finally { await sql.end() }
}

main().catch(() => { console.error('Owner provisioning failed. Check the account, credentials, database migrations and existing owner. No secrets are printed.'); process.exitCode = 1 })
