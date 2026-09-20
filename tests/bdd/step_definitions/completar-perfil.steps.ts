import assert from 'node:assert/strict'

import { After, AfterAll, Before, Given, Then, When } from '@cucumber/cucumber'

import {
  completeProfileForSession,
  type ClerkUserReader,
} from '../../../src/server/actions/complete-profile'
import {
  resolveAccountGate,
  writeLetterRedirect,
} from '../../../src/server/auth/account-gate'
import { createTestDb, truncateProductTables } from '../../support/database'
import { AtinyWorld } from '../support/world'

const db = createTestDb()

const verifiedClerkUser: Awaited<ReturnType<ClerkUserReader>> = {
  primaryEmailAddressId: 'email_1',
  emailAddresses: [{ id: 'email_1', verification: { status: 'verified' } }],
}

const identityOrNull = (world: AtinyWorld) => async () =>
  world.clerkUserId ? { clerkUserId: world.clerkUserId } : null

const clerkAuthReader = (world: AtinyWorld) => async () =>
  ({ userId: world.clerkUserId ?? null })

Before(async function () {
  await truncateProductTables(db)
})

After(async function () {
  await truncateProductTables(db)
})

AfterAll(async function () {
  await db.end()
})

Given(
  'que Clerk identifica a la fan {string} con correo verificado y perfil incompleto',
  function (this: AtinyWorld, clerkUserId: string) {
    this.clerkUserId = clerkUserId
    this.clerkUser = verifiedClerkUser
  },
)

Given(
  'que Clerk identifica a la fan {string} con perfil completo',
  async function (this: AtinyWorld, clerkUserId: string) {
    this.clerkUserId = clerkUserId
    this.clerkUser = verifiedClerkUser
    await db`
      insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name)
      values (${clerkUserId}, 'ready-atiny', 'ready-atiny', 'Ready ATINY')
    `
  },
)

Given(
  'el usuario {string} ya pertenece a otra cuenta',
  async function (this: AtinyWorld, username: string) {
    await db`
      insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name)
      values ('other-account', ${username}, ${username.toLowerCase()}, 'Otra cuenta')
    `
  },
)

When(
  'completo el usuario {string} y el nombre público {string}',
  async function (this: AtinyWorld, username: string, displayName: string) {
    this.profileActionResult = await completeProfileForSession(
      db,
      { username, displayName },
      identityOrNull(this),
      async () => this.clerkUser ?? null,
    )
  },
)

When(
  'completo el perfil sin usuario ni nombre público',
  async function (this: AtinyWorld) {
    this.profileActionResult = await completeProfileForSession(
      db,
      { username: '   ', displayName: '   ' },
      identityOrNull(this),
      async () => this.clerkUser ?? null,
    )
  },
)

When('intenta escribir una carta', async function (this: AtinyWorld) {
  this.accountGate = await resolveAccountGate(db, clerkAuthReader(this))
})

Then('el perfil queda completo con rol fan', async function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, true)
  const rows = await db<{ role: string }[]>`
    select role from app_private.profiles where clerk_user_id = ${this.clerkUserId!}
  `
  assert.equal(rows[0].role, 'fan')
})

Then(
  'la fan puede acceder a la publicación sin volver a estar bloqueada',
  async function (this: AtinyWorld) {
    const gate = await resolveAccountGate(db, clerkAuthReader(this))
    assert.equal(gate.kind, 'allowed')
  },
)

Then('se la dirige a completar el perfil', function (this: AtinyWorld) {
  assert.ok(this.accountGate)
  assert.equal(writeLetterRedirect(this.accountGate, 'es'), '/es/profile')
})

Then('puede continuar hacia la publicación', function (this: AtinyWorld) {
  assert.ok(this.accountGate)
  assert.equal(writeLetterRedirect(this.accountGate, 'es'), null)
})

Then(
  'recibo un error de usuario ocupado en el campo de usuario',
  function (this: AtinyWorld) {
    assert.equal(this.profileActionResult?.ok, false)
    assert.ok(this.profileActionResult && !this.profileActionResult.ok)
    assert.equal(this.profileActionResult.error.messageKey, 'profile.usernameUnavailable')
  },
)

Then('recibo errores de campo para usuario y nombre público', function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, false)
  assert.ok(this.profileActionResult && !this.profileActionResult.ok)
  assert.deepEqual(this.profileActionResult.error.fieldErrors, {
    username: 'profile.usernameRequired',
    displayName: 'profile.displayNameRequired',
  })
})

Then('recibo una salida clara de sesión ausente', function (this: AtinyWorld) {
  assert.equal(this.profileActionResult?.ok, false)
  assert.ok(this.profileActionResult && !this.profileActionResult.ok)
  assert.equal(this.profileActionResult.error.code, 'NOT_FOUND')
  assert.equal(this.profileActionResult.error.messageKey, 'auth.unauthenticated')
})