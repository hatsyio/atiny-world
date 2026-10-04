import assert from 'node:assert/strict'

import { After, AfterAll, Before, Given, Then, When } from '@cucumber/cucumber'

import { completeProfileForSession } from '../../../src/server/actions/complete-profile'
import { resolveAccountGate, writeLetterRedirect } from '../../../src/server/auth/account-gate'
import { createTestDb, truncateProductTables } from '../../support/database'
import { AtinyWorld } from '../support/world'

const db = createTestDb()
const identityOrNull = (world: AtinyWorld) => async () =>
  world.clerkUserId ? { clerkUserId: world.clerkUserId } : null
const clerkAuthReader = (world: AtinyWorld) => async () =>
  ({ userId: world.clerkUserId ?? null })

Before(async () => { await truncateProductTables(db) })
After(async () => { await truncateProductTables(db) })
AfterAll(async () => { await db.end() })

Given('que Clerk identifica a la fan {string} sin correo y con perfil incompleto', function (this: AtinyWorld, id: string) {
  this.clerkUserId = id
  this.clerkUser = {
    id,
    username: null,
    unsafeMetadata: {},
  }
})

Given('que Clerk identifica a la fan {string} con perfil completo', async function (this: AtinyWorld, id: string) {
  this.clerkUserId = id
  await db`insert into app_private.profiles (clerk_user_id, display_name) values (${id}, 'Ready ATINY')`
})

When('Clerk entrega el username {string}', async function (this: AtinyWorld, username: string) {
  if (this.clerkUser) this.clerkUser.username = username
  this.profileActionResult = await completeProfileForSession(db, identityOrNull(this), async () => this.clerkUser ?? null)
})

When('intenta escribir una carta', async function (this: AtinyWorld) {
  this.accountGate = await resolveAccountGate(db, clerkAuthReader(this), undefined, async () => false)
})

Then('el perfil queda completo con rol fan', async function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, true)
  const rows = await db<{ role: string }[]>`select role from app_private.profiles where clerk_user_id = ${this.clerkUserId!}`
  assert.equal(rows[0].role, 'fan')
})

Then('la fan puede acceder a la publicación sin volver a estar bloqueada', async function (this: AtinyWorld) {
  const gate = await resolveAccountGate(db, clerkAuthReader(this))
  assert.equal(gate.kind, 'allowed')
})

Then('se la dirige a reintentar la creación del perfil', function (this: AtinyWorld) {
  assert.ok(this.accountGate)
  assert.equal(writeLetterRedirect(this.accountGate, 'es'), '/es/profile?next=%2Fes%2Fmessages%2Fnew')
})

Then('puede continuar hacia la publicación', function (this: AtinyWorld) {
  assert.ok(this.accountGate)
  assert.equal(writeLetterRedirect(this.accountGate, 'es'), null)
})

Then('recibo un error para el username', function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, false)
  assert.ok(this.profileActionResult && !this.profileActionResult.ok)
  assert.equal(this.profileActionResult.error.fieldErrors?.username, 'profile.usernameRequired')
})

Then('recibo una salida clara de sesión ausente', function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, false)
  assert.ok(this.profileActionResult && !this.profileActionResult.ok)
  assert.equal(this.profileActionResult.error.code, 'NOT_FOUND')
})
