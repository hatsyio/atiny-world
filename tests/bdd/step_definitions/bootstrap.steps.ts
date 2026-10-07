import assert from 'node:assert/strict'

import { Given, Then, When } from '@cucumber/cucumber'

import { getPublicAppIdentity } from '../../../src/app-identity'
import { getSessionIdentity } from '../../../src/server/auth/session'
import { AtinyAtlasWorld } from '../support/world'

When('consulto la identidad pública de la aplicación', function (this: AtinyAtlasWorld) {
  this.actualName = getPublicAppIdentity().name
})

Then('el nombre es {string}', function (this: AtinyAtlasWorld, expectedName: string) {
  assert.equal(this.actualName, expectedName)
})

Given('que Clerk no identifica a la visitante', function (this: AtinyAtlasWorld) {
  this.authReader = async () => ({ userId: null })
})

Given(
  'que Clerk identifica a la fan como {string}',
  function (this: AtinyAtlasWorld, userId: string) {
    this.authReader = async () => ({ userId })
  },
)

When('resuelvo la sesión en el servidor', async function (this: AtinyAtlasWorld) {
  assert.ok(this.authReader)
  this.sessionIdentity = await getSessionIdentity(this.authReader)
})

Then('la sesión es anónima', function (this: AtinyAtlasWorld) {
  assert.equal(this.sessionIdentity, null)
})

Then(
  'la sesión pertenece a {string}',
  function (this: AtinyAtlasWorld, clerkUserId: string) {
    assert.deepEqual(this.sessionIdentity, { clerkUserId })
  },
)
