import assert from 'node:assert/strict'
import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'
import { moderateMessage, type ModerateMessageSuccess } from '../../../src/server/moderation/moderate-message'
import { searchModerationMessages } from '../../../src/server/moderation/message-repository'
import { getVisibleMessage, listFeaturesInViewport } from '../../../src/server/messages/public-repository'
import { pageOwnMessages } from '../../../src/server/messages/own-message-repository'
import { updateMessage } from '../../../src/server/messages/update-message'
import type { ActionResult } from '../../../src/domain/contracts'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../../support/database'
import type { AtinyWorld } from '../support/world'

type ModerationWorld = AtinyWorld & {
  moderationResult?: ActionResult<ModerateMessageSuccess>
  sourceStatus: string
  sourceContent: string
}
const db = createTestDb()
async function clean() {
  await db`delete from app_private.moderation_actions`
  await db`delete from app_private.admin_audit`
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false where id = 1`
}
After({ tags: '@moderation' }, clean)
AfterAll(async () => { await db.end() })

Given('una administradora revisando una carta {string} con moderación previa {word}', async function (this: ModerationWorld, status: string, premoderation: string) {
  await clean()
  await insertProfile(db, 'bdd-moderator', { role: 'admin' })
  const author = await insertProfile(db, 'bdd-moderation-author')
  this.sourceContent = 'Una carta que conserva su texto y ubicación'
  const message = await insertMessage(db, author.id, { status, content: this.sourceContent })
  this.publicId = message.public_id
  this.sourceStatus = status
  await db`update app_private.settings set premoderation_enabled = ${premoderation === 'activada'} where id = 1`
})
Given('la autora edita la carta después de que la administradora la consulte', async function (this: ModerationWorld) {
  assert.ok((await updateMessage(db, { clerkUserId: 'bdd-moderation-author', publicId: this.publicId!, expectedVersion: 1, content: 'Nueva versión de la autora' })).ok)
})
Given('el propietario retira su rol antes de aplicar la decisión', async () => {
  await db`update app_private.profiles set role = 'fan' where clerk_user_id = 'bdd-moderator'`
})
When('decide {string} sobre la versión revisada sin motivo', async function (this: ModerationWorld, decision: string) {
  this.moderationResult = await moderateMessage(db, { clerkUserId: 'bdd-moderator', publicId: this.publicId!, expectedVersion: 1, decision })
})
When('decide {string} sobre la versión revisada con motivo {string}', async function (this: ModerationWorld, decision: string, reasonCode: string) {
  this.moderationResult = await moderateMessage(db, { clerkUserId: 'bdd-moderator', publicId: this.publicId!, expectedVersion: 1, decision, reasonCode, note: 'Nota privada para la autora' })
})
Then('la carta queda {string} y es pública', async function (this: ModerationWorld, status: string) {
  assert.ok(this.moderationResult?.ok)
  assert.equal(this.moderationResult.data.status, status)
  assert.equal((await getVisibleMessage(db, this.publicId!))?.content, this.sourceContent)
  const features = await listFeaturesInViewport(db, { west: -10, south: 30, east: 10, north: 50 })
  assert.equal(features.length, 1)
  assert.equal('status' in features[0], false)
  assert.equal('moderationReasonCode' in features[0], false)
})
Then('la carta queda {string} y está oculta', async function (this: ModerationWorld, status: string) {
  assert.ok(this.moderationResult?.ok)
  assert.equal(this.moderationResult.data.status, status)
  assert.equal(await getVisibleMessage(db, this.publicId!), null)
  assert.equal((await listFeaturesInViewport(db, { west: -10, south: 30, east: 10, north: 50 })).length, 0)
  const rows = await db`select content, st_x(public_point::geometry) as longitude, st_y(public_point::geometry) as latitude from app_private.messages where public_id = ${this.publicId!}`
  assert.equal(rows[0].content, this.sourceContent)
  assert.equal(rows[0].longitude, -2.5)
  assert.equal(rows[0].latitude, 39.5)
})
Then('la autora consulta el motivo {string} y la nota privada', async function (this: ModerationWorld, reasonCode: string) {
  const own = await pageOwnMessages(db, { clerkUserId: 'bdd-moderation-author' })
  assert.equal(own.items[0].moderationReasonCode, reasonCode)
  assert.equal(own.items[0].moderationNote, 'Nota privada para la autora')
})
Then('la decisión y su auditoría conservan la versión revisada sin copiar el texto', async function (this: ModerationWorld) {
  const actions = await db`select message_public_id, message_version from app_private.moderation_actions`
  assert.equal(actions.length, 1)
  assert.equal(actions[0].message_public_id, this.publicId)
  assert.equal(actions[0].message_version, 1)
  const audit = await db`select metadata from app_private.admin_audit`
  assert.equal(audit.length, 1)
  assert.equal(audit[0].metadata.messageVersion, 1)
  assert.equal(audit[0].metadata.resultingVersion, 2)
  assert.equal(JSON.stringify(audit).includes(this.sourceContent), false)
  assert.equal(JSON.stringify(audit).includes('Nota privada'), false)
})
Then('se rechaza la decisión obsoleta conservando la edición sin auditoría parcial', async function (this: ModerationWorld) {
  assert.ok(this.moderationResult && !this.moderationResult.ok)
  assert.equal(this.moderationResult.error.code, 'MESSAGE_VERSION_CONFLICT')
  const rows = await db`select status, version, content from app_private.messages where public_id = ${this.publicId!}`
  assert.deepEqual(rows[0], { status: 'pending', version: 2, content: 'Nueva versión de la autora' })
  assert.equal((await db`select * from app_private.moderation_actions`).length, 0)
  assert.equal((await db`select * from app_private.admin_audit`).length, 0)
})
Then('la decisión se rechaza sin cambios ni auditoría', async function (this: ModerationWorld) {
  assert.ok(this.moderationResult && !this.moderationResult.ok)
  const rows = await db`select status, version, content from app_private.messages where public_id = ${this.publicId!}`
  assert.deepEqual(rows[0], { status: this.sourceStatus, version: 1, content: this.sourceContent })
  assert.equal((await db`select * from app_private.moderation_actions`).length, 0)
  assert.equal((await db`select * from app_private.admin_audit`).length, 0)
})
Then('la cola privada no revela cartas a la cuenta sin permisos', async () => {
  const result = await searchModerationMessages(db, 'bdd-moderator', { query: '', status: 'all', page: 1 })
  assert.ok(!result.ok)
  assert.equal(result.error.code, 'NOT_FOUND')
})
