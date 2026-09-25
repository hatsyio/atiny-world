import assert from 'node:assert/strict'

import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'

import { GET as getPublicMessage } from '../../../src/app/api/messages/[publicId]/route'
import { deleteMessageForSession } from '../../../src/server/actions/delete-message'
import { updateMessageForSession } from '../../../src/server/actions/update-message'
import { pageOwnMessages } from '../../../src/server/messages/own-message-repository'
import { signLocationSelection, verifyLocationSelectionResult } from '../../../src/server/locations/selection-token'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../../support/database'
import { AtinyWorld } from '../support/world'

const db = createTestDb()
const ownerId = 'bdd-us3-owner'
const foreignId = 'bdd-us3-foreign'
const locationSecret = 'bdd-us3-location-secret'

async function reset(world: AtinyWorld) {
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 10 where id = 1`
  world.clerkUserId = ownerId
  world.publicId = undefined
  world.hiddenId = undefined
  world.responses = []
}

async function addOwnMessage(
  world: AtinyWorld,
  options: Parameters<typeof insertMessage>[2] = {},
) {
  const profile = await insertProfile(db, ownerId)
  const message = await insertMessage(db, profile.id, options)
  world.publicId = message.public_id
  world.originalPoint = {
    latitude: options.latitude ?? 39.5,
    longitude: options.longitude ?? -2.5,
  }
  return message
}

function auth(world: AtinyWorld) {
  return async () => world.clerkUserId ? { clerkUserId: world.clerkUserId } : null
}

async function publicDetail(publicId: string) {
  const response = await getPublicMessage(new Request(`http://localhost/api/messages/${publicId}`))
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

After({ tags: '@us3' }, async function () {
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 10 where id = 1`
})

AfterAll(async function () {
  await db.end()
})

Given('una fan con mensajes visibles y ocultos', async function (this: AtinyWorld) {
  await reset(this)
  const profile = await insertProfile(db, ownerId)
  const visible = await insertMessage(db, profile.id, { status: 'approved', content: 'Texto visible', moderation_reason_code: null })
  const hidden = await insertMessage(db, profile.id, { status: 'rejected', content: 'Texto oculto', moderation_reason_code: 'community_guidelines', moderation_note: 'Nota privada' })
  this.publicId = visible.public_id
  this.hiddenId = hidden.public_id
})

Given('una fan con un mensaje propio visible', async function (this: AtinyWorld) {
  await reset(this)
  await addOwnMessage(this, { status: 'approved', content: 'Mensaje localizable' })
})

Given('un mensaje propio aprobado', async function (this: AtinyWorld) {
  await reset(this)
  await addOwnMessage(this, { status: 'approved', content: 'Texto original' })
})

Given('un mensaje propio rechazado con motivo', async function (this: AtinyWorld) {
  await reset(this)
  await addOwnMessage(this, { status: 'rejected', moderation_reason_code: 'community_guidelines', moderation_note: 'Nota privada', content: 'Texto rechazado' })
})

Given('un mensaje propio con una ubicación aproximada', async function (this: AtinyWorld) {
  await reset(this)
  await addOwnMessage(this, { status: 'approved', location_precision: 'approximate', content: 'Mensaje con punto' })
})

Given('una fan en el límite de mensajes con un mensaje propio', async function (this: AtinyWorld) {
  await reset(this)
  await db`update app_private.settings set message_limit = 1 where id = 1`
  await addOwnMessage(this, { status: 'approved', content: 'Único mensaje permitido' })
})

Given('un mensaje de otra fan', async function (this: AtinyWorld) {
  await reset(this)
  const profile = await insertProfile(db, foreignId)
  await insertProfile(db, ownerId)
  const message = await insertMessage(db, profile.id, { status: 'approved', content: 'Texto de otra fan' })
  this.publicId = message.public_id
  this.foreignClerkUserId = foreignId
})

Given('un mensaje de una fan', async function (this: AtinyWorld) {
  await reset(this)
  const profile = await insertProfile(db, foreignId)
  const message = await insertMessage(db, profile.id, { status: 'approved', content: 'Texto de una fan' })
  await insertProfile(db, ownerId, { role: 'admin' })
  this.publicId = message.public_id
  this.foreignClerkUserId = foreignId
})

When('abro {string}', async function (this: AtinyWorld, label: string) {
  assert.equal(label, 'Mis mensajes')
  this.ownMessages = await pageOwnMessages(db, { clerkUserId: this.clerkUserId! })
})

When('uso {string} sobre ese mensaje', async function (this: AtinyWorld, label: string) {
  assert.equal(label, 'localizar')
  this.ownMessages = await pageOwnMessages(db, { clerkUserId: this.clerkUserId! })
})

When('edito solo el texto del mensaje', async function (this: AtinyWorld) {
  this.updateResult = await updateMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, content: 'Texto actualizado',
  }, { readAuth: auth(this) })
})

When('edito su texto', async function (this: AtinyWorld) {
  this.updateResult = await updateMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, content: 'Texto corregido',
  }, { readAuth: auth(this) })
})

When('cambio la ubicación del mensaje', async function (this: AtinyWorld) {
  const token = signLocationSelection({
    locality: 'Barcelona', country: 'España', countryCode: 'es',
    point: { latitude: 41.3874, longitude: 2.1686 }, attribution: 'Geoapify',
  }, locationSecret)
  this.updateResult = await updateMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, content: 'Mensaje con ubicación nueva',
    location: { selectionId: token, precision: 'approximate' },
  }, {
    readAuth: auth(this),
    verifySelection: (value) => verifyLocationSelectionResult(value, locationSecret),
  })
})

When('elimina ese mensaje tras confirmarlo', async function (this: AtinyWorld) {
  this.deleteResult = await deleteMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, confirmation: true,
  }, { readAuth: auth(this) })
})

When('una fan distinta de la autora intenta reescribir su texto', async function (this: AtinyWorld) {
  this.clerkUserId = ownerId
  this.updateResult = await updateMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, content: 'Intento de reescritura',
  }, { readAuth: auth(this) })
})

When('un administrador intenta reescribir su texto', async function (this: AtinyWorld) {
  this.clerkUserId = ownerId
  this.updateResult = await updateMessageForSession(db, {
    publicId: this.publicId!, expectedVersion: 1, content: 'Intento de reescritura',
  }, { readAuth: auth(this) })
})

Then('consulto todos mis mensajes con su estado y el motivo de moderación cuando exista', function (this: AtinyWorld) {
  assert.equal(this.ownMessages?.items.length, 2)
  assert.deepEqual(new Set(this.ownMessages?.items.map((item) => item.status)), new Set(['approved', 'rejected']))
  const rejected = this.ownMessages?.items.find((item) => item.status === 'rejected')
  assert.equal(rejected?.moderationReasonCode, 'community_guidelines')
  assert.equal(rejected?.moderationNote, 'Nota privada')
})

Then('ningún estado ni motivo privado aparece en las respuestas públicas', async function (this: AtinyWorld) {
  const response = await publicDetail(this.publicId!)
  assert.equal(response.status, 200)
  assert.equal('status' in response.body, false)
  assert.equal('moderationReasonCode' in response.body, false)
  assert.equal('moderationNote' in response.body, false)
})

Then('el mapa se centra en el punto del mensaje y su enlace estable abre la ficha', async function (this: AtinyWorld) {
  const item = this.ownMessages?.items.find((message) => message.publicId === this.publicId)
  assert.deepEqual(item?.point, this.originalPoint)
  const detail = await publicDetail(this.publicId!)
  assert.equal(detail.status, 200)
  assert.equal(detail.body.publicId, this.publicId)
})

Then('el mensaje vuelve a pendiente e incrementa su versión', async function (this: AtinyWorld) {
  assert.ok(this.updateResult?.ok)
  assert.equal(this.updateResult.data.version, 2)
  const rows = await db<Array<{ version: number; status: string }>>`select version, status from app_private.messages where public_id = ${this.publicId!}`
  assert.deepEqual(rows[0], { version: 2, status: 'pending' })
})

Then('el contenido anterior deja de mostrarse públicamente conservando el enlace y el mismo punto público', async function (this: AtinyWorld) {
  const rows = await db<Array<{ content: string; latitude: number; longitude: number }>>`
    select content, st_y(public_point::geometry) as latitude, st_x(public_point::geometry) as longitude
      from app_private.messages where public_id = ${this.publicId!}
  `
  assert.equal(rows[0].content, 'Texto actualizado')
  assert.deepEqual({ latitude: rows[0].latitude, longitude: rows[0].longitude }, this.originalPoint)
  const detail = await publicDetail(this.publicId!)
  assert.equal(detail.status, 200)
  assert.equal(detail.body.publicId, this.publicId)
  assert.equal(detail.body.content, 'Texto actualizado')
})

Then('el mensaje vuelve a pendiente y queda sin motivo de moderación', async function (this: AtinyWorld) {
  assert.ok(this.updateResult?.ok)
  const rows = await db<Array<{ status: string; moderation_reason_code: string | null; moderation_note: string | null }>>`
    select status, moderation_reason_code, moderation_note from app_private.messages where public_id = ${this.publicId!}
  `
  assert.deepEqual(rows[0], { status: 'pending', moderation_reason_code: null, moderation_note: null })
})

Then('puedo elegir un nuevo punto y el mensaje vuelve a pendiente conservando su enlace estable', async function (this: AtinyWorld) {
  assert.ok(this.updateResult?.ok)
  assert.equal(this.updateResult.data.status, 'pending')
  const rows = await db<Array<{ version: number; latitude: number; longitude: number; status: string }>>`
    select version, st_y(public_point::geometry) as latitude, st_x(public_point::geometry) as longitude, status
      from app_private.messages where public_id = ${this.publicId!}
  `
  assert.equal(rows[0].version, 2)
  assert.equal(rows[0].status, 'pending')
  assert.notDeepEqual({ latitude: rows[0].latitude, longitude: rows[0].longitude }, this.originalPoint)
  assert.equal((await publicDetail(this.publicId!)).body.publicId, this.publicId)
})

Then('el mensaje deja de estar disponible públicamente y libera un espacio del límite', async function (this: AtinyWorld) {
  assert.ok(this.deleteResult?.ok)
  assert.equal((await publicDetail(this.publicId!)).status, 404)
  const rows = await db<Array<{ count: number }>>`select count(*)::int as count from app_private.messages m join app_private.profiles p on p.id = m.author_id where p.clerk_user_id = ${ownerId}`
  const settings = await db<Array<{ message_limit: number }>>`select message_limit from app_private.settings where id = 1`
  assert.equal(settings[0].message_limit - rows[0].count, 1)
})

Then('la eliminación no es un estado recuperable', async function (this: AtinyWorld) {
  const rows = await db<Array<{ count: number }>>`select count(*)::int as count from app_private.messages where public_id = ${this.publicId!}`
  assert.equal(rows[0].count, 0)
})

Then('la operación se rechaza sin modificar contenido ni estado', async function (this: AtinyWorld) {
  assert.ok(this.updateResult && !this.updateResult.ok)
  assert.equal(this.updateResult.error.code, 'NOT_FOUND')
  const rows = await db<Array<{ content: string; status: string; version: number }>>`select content, status, version from app_private.messages where public_id = ${this.publicId!}`
  assert.ok(['Texto de otra fan', 'Texto de una fan'].includes(rows[0].content))
  assert.equal(rows[0].status, 'approved')
  assert.equal(rows[0].version, 1)
})
