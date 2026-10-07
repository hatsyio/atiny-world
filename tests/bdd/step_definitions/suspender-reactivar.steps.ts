import assert from 'node:assert/strict'
import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'
import { setSuspension, type SetSuspensionSuccess } from '../../../src/server/moderation/accounts'
import { getVisibleMessage, listFeaturesInViewport } from '../../../src/server/messages/public-repository'
import { pageOwnMessages } from '../../../src/server/messages/own-message-repository'
import { updateMessage } from '../../../src/server/messages/update-message'
import { deleteMessage } from '../../../src/server/messages/delete-message'
import type { ActionResult } from '../../../src/domain/contracts'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../../support/database'
import type { AtinyAtlasWorld } from '../support/world'

type SuspensionWorld = AtinyAtlasWorld & { targetId: string; letterIds: string[]; suspensionResult?: ActionResult<SetSuspensionSuccess> }
const db = createTestDb()
async function clean() {
  await db`delete from app_private.moderation_actions`
  await db`delete from app_private.admin_audit`
  await db`update app_private.settings set premoderation_enabled = false, updated_by = null where id = 1`
  await truncateProductTables(db)
}
After({ tags: '@suspension' }, clean)
AfterAll(async () => { await db.end() })
Given('una administradora y una fan con cartas pendientes y aprobadas', async function (this: SuspensionWorld) {
  await clean()
  await insertProfile(db, 'bdd-suspend-admin', { role: 'admin' })
  const fan = await insertProfile(db, 'bdd-suspend-fan')
  this.targetId = fan.public_id
  this.letterIds = []
  for (const status of ['pending', 'approved']) this.letterIds.push((await insertMessage(db, fan.id, { status })).public_id)
})
When('suspende a la fan con motivo {string}', async function (this: SuspensionWorld, reasonCode: string) {
  this.suspensionResult = await setSuspension(db, { clerkUserId: 'bdd-suspend-admin', publicId: this.targetId, suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode, note: 'Nota privada interna' })
})
Then('las cartas de la fan quedan ocultas sin cambiar sus versiones', async function (this: SuspensionWorld) {
  assert.ok(this.suspensionResult?.ok)
  for (const id of this.letterIds) assert.equal(await getVisibleMessage(db, id), null)
  assert.equal((await listFeaturesInViewport(db, { west: -10, south: 30, east: 10, north: 50 })).length, 0)
  assert.deepEqual((await db`select version from app_private.messages order by id`).map(r => r.version), [1, 1])
})
Then('la fan puede leer y borrar sus cartas pero no editarlas', async function (this: SuspensionWorld) {
  assert.equal((await pageOwnMessages(db, { clerkUserId: 'bdd-suspend-fan' })).items.length, 2)
  const edit = await updateMessage(db, { clerkUserId: 'bdd-suspend-fan', publicId: this.letterIds[0], expectedVersion: 1, content: 'Edición prohibida' })
  assert.ok(!edit.ok)
  assert.equal(edit.error.code, 'ACCOUNT_SUSPENDED')
  assert.ok((await deleteMessage(db, { clerkUserId: 'bdd-suspend-fan', publicId: this.letterIds[0], expectedVersion: 1, confirmation: true })).ok)
})
Then('la suspensión y su auditoría quedan registradas sin copiar la nota', async () => {
  const actions = await db`select action, note from app_private.moderation_actions`
  assert.equal(actions.length, 1)
  assert.equal(actions[0].action, 'suspend')
  assert.equal(actions[0].note, 'Nota privada interna')
  const audit = await db`select action, metadata from app_private.admin_audit`
  assert.equal(audit.length, 1)
  assert.equal(audit[0].action, 'suspend')
  assert.equal(JSON.stringify(audit).includes('Nota privada interna'), false)
})
Given('la fan está suspendida y la moderación previa está {word}', async function (this: SuspensionWorld, mode: string) {
  assert.ok((await setSuspension(db, { clerkUserId: 'bdd-suspend-admin', publicId: this.targetId, suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode: 'conduct' })).ok)
  await db`update app_private.settings set premoderation_enabled = ${mode === 'activada'} where id = 1`
})
When('reactiva a la fan con la versión actual', async function (this: SuspensionWorld) {
  this.suspensionResult = await setSuspension(db, { clerkUserId: 'bdd-suspend-admin', publicId: this.targetId, suspended: false, expectedRoleVersion: 1, expectedSuspensionVersion: 2 })
})
Then('quedan visibles {int} cartas de la fan sin cambiar sus versiones', async function (this: SuspensionWorld, count: number) {
  assert.ok(this.suspensionResult?.ok)
  assert.equal((await listFeaturesInViewport(db, { west: -10, south: 30, east: 10, north: 50 })).length, count)
  assert.deepEqual((await db`select version from app_private.messages order by id`).map(r => r.version), [1, 1])
})
Given('la fan ahora tiene rol de administradora', async function (this: SuspensionWorld) {
  await db`update app_private.profiles set role = 'admin' where public_id = ${this.targetId}`
})
Then('se rechaza la suspensión sin auditoría parcial', async function (this: SuspensionWorld) {
  assert.ok(this.suspensionResult && !this.suspensionResult.ok)
  assert.equal(this.suspensionResult.error.code, 'NOT_FOUND')
  assert.equal((await db`select * from app_private.admin_audit`).length, 0)
})
Given('la fan ya ha sido suspendida por otra administradora', async function (this: SuspensionWorld) {
  assert.ok((await setSuspension(db, { clerkUserId: 'bdd-suspend-admin', publicId: this.targetId, suspended: true, expectedRoleVersion: 1, expectedSuspensionVersion: 1, reasonCode: 'conduct' })).ok)
})
Then('se rechaza el formulario antiguo sin repetir la auditoría', async function (this: SuspensionWorld) {
  assert.ok(this.suspensionResult && !this.suspensionResult.ok)
  assert.equal(this.suspensionResult.error.code, 'MESSAGE_VERSION_CONFLICT')
  assert.equal((await db`select * from app_private.admin_audit`).length, 1)
})
