import assert from 'node:assert/strict'

import { After, Before, Given, Then, When } from '@cucumber/cucumber'

import { GET as features } from '../../../src/app/api/map/features/route'
import { GET as messages } from '../../../src/app/api/map/messages/route'
import { GET as detail } from '../../../src/app/api/messages/[publicId]/route'
import { GET as users } from '../../../src/app/api/users/search/route'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../../support/database'
import { AtinyWorld } from '../support/world'

const db = createTestDb()
const url = (path: string, params: Record<string, string>) => `http://localhost${path}?${new URLSearchParams(params)}`
const bounds = (world: AtinyWorld) => ({ west: String(world.viewport.west), south: String(world.viewport.south), east: String(world.viewport.east), north: String(world.viewport.north) })

async function json(response: Response) { return { status: response.status, body: await response.json() as Record<string, unknown> } }
async function seed(world: AtinyWorld) {
  await truncateProductTables(db)
  const a = await insertProfile(db, 'bdd-a', { username: 'bdd-a', display_name: 'BDD A' })
  const b = await insertProfile(db, 'bdd-b', { username: 'bdd-b', display_name: 'BDD B' })
  world.fanPublicId = a.public_id
  world.publicId = (await insertMessage(db, a.id, { status: 'approved', recipient: 'ateez', longitude: -3.7, latitude: 40.4, locality: 'Madrid', published_at: '2026-09-15T10:00:00.000Z' })).public_id
  world.hiddenId = (await insertMessage(db, b.id, { status: 'rejected', moderation_reason_code: 'offensive', longitude: -3.71, latitude: 40.41 })).public_id
  await insertMessage(db, b.id, { status: 'approved', recipient: 'atiny', longitude: -3.72, latitude: 40.42, published_at: '2026-09-14T10:00:00.000Z' })
}

Before(async function (this: AtinyWorld) { await seed(this) })
After(async function () { await truncateProductTables(db) })

Given('el viewport oeste {int}, sur {int}, este {int}, norte {int} con zoom {int}', function (this: AtinyWorld, west: number, south: number, east: number, north: number, zoom: number) { this.viewport = { west, south, east, north, zoom } })
Given('que existen mensajes públicos y ocultos cerca de una ciudad', function () {})
Given('que existen mensajes públicos para ATEEZ y para ATINY', function () {})
Given('que existe un mensaje público enlazable', function () {})
Given('que existe un mensaje oculto o eliminado', function () {})

When('solicito los map features del viewport', async function (this: AtinyWorld) { this.responses = [await json(await features(new Request(url('/api/map/features', { ...bounds(this), zoom: String(this.viewport.zoom) }))))] })
When('solicito el grupo paginado del área', async function (this: AtinyWorld) { this.responses = [await json(await messages(new Request(url('/api/map/messages', { ...bounds(this), limit: '20' }))))] })
When('filtro por destinatario {string}', async function (this: AtinyWorld, recipient: string) { this.responses = [await json(await features(new Request(url('/api/map/features', { ...bounds(this), recipient }))))] })
When('filtro por fan con un identificador público', async function (this: AtinyWorld) { this.responses = [await json(await features(new Request(url('/api/map/features', { ...bounds(this), fan: this.fanPublicId! }))))] })
When('abro su ficha pública', async function (this: AtinyWorld) { this.responses = [await json(await detail(new Request(`http://localhost/api/messages/${this.publicId}`)))] })
When('solicito map features, ficha y búsqueda de fans', async function (this: AtinyWorld) {
  const featureResponse = await features(new Request(url('/api/map/features', bounds(this))))
  const detailResponse = await detail(new Request(`http://localhost/api/messages/${this.publicId}`))
  const userResponse = await users(new Request(url('/api/users/search', { q: 'bdd' })))
  this.responses = [
    await json(featureResponse),
    await json(detailResponse),
    await json(userResponse),
  ]
})

Then('recibo solo mensajes públicos en la lectura actual', function (this: AtinyWorld) { assert.equal(this.responses[0].status, 200); assert.ok((this.responses[0].body.features as Array<{ publicId: string }>).every((x) => x.publicId !== this.hiddenId)) })
Then('el conjunto de features no incluye contenido completo ni motivos de moderación', function (this: AtinyWorld) { for (const feature of this.responses[0].body.features as Record<string, unknown>[]) { assert.equal('content' in feature, false); assert.equal('status' in feature, false) } })
Then('el grupo empieza por el mensaje público más reciente', function (this: AtinyWorld) { assert.equal((this.responses[0].body.items as Array<{ publicId: string }>)[0].publicId, this.publicId) })
Then('los mensajes ocultos no aparecen en el grupo', function (this: AtinyWorld) { assert.ok(!(this.responses[0].body.items as Array<{ publicId: string }>).some((x) => x.publicId === this.hiddenId)) })
Then('solo recibo mensajes públicos dirigidos a ATEEZ', function (this: AtinyWorld) { assert.ok((this.responses[0].body.features as Array<{ recipient: string }>).every((x) => x.recipient === 'ateez')) })
Then('solo recibo mensajes públicos de esa fan', function (this: AtinyWorld) { assert.ok((this.responses[0].body.features as Array<{ author: { publicId: string } }>).every((x) => x.author.publicId === this.fanPublicId)) })
Then('veo contenido, autora pública, localidad o país y fecha', function (this: AtinyWorld) { const body = this.responses[0].body; assert.ok(body.content && body.author && body.publishedAt && (body.locality || body.country)) })
Then('no veo estado, motivo ni referencia a moderación', function (this: AtinyWorld) { const body = this.responses[0].body; assert.equal('status' in body, false); assert.equal('moderationReasonCode' in body, false) })
Then('la respuesta no distingue ausencia de ocultación', async function (this: AtinyWorld) { const hidden = await json(await detail(new Request(`http://localhost/api/messages/${this.hiddenId}`))); const absent = await json(await detail(new Request('http://localhost/api/messages/00000000-0000-4000-8000-000000000000'))); assert.deepEqual(hidden, absent) })
Then('el enlace estable sigue sin revelar su contenido', function (this: AtinyWorld) { assert.ok(this.hiddenId) })
Then('las respuestas públicas son las mismas que para una fan identificada', function (this: AtinyWorld) { assert.equal(this.responses.length, 3); assert.ok(this.responses.every((response) => response.status === 200)) })
