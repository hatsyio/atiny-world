import assert from 'node:assert/strict'

import { After, AfterAll, Given, Then, When } from '@cucumber/cucumber'

import { GET as getMapFeatures } from '../../../src/app/api/map/features/route'
import { GET as getPublicMessage } from '../../../src/app/api/messages/[publicId]/route'
import { createLocationSuggestionsPostHandler } from '../../../src/app/api/locations/suggestions/route'
import { createMessageForSession, type CreateMessageActionInput } from '../../../src/server/actions/create-message'
import { searchGeoapifyLocations } from '../../../src/server/locations/geoapify'
import { signLocationSelection, verifyLocationSelectionResult } from '../../../src/server/locations/selection-token'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../../support/database'
import { AtinyWorld } from '../support/world'

const db = createTestDb()
const selectionSecret = 'bdd-us2-location-selection-secret'
const point = { latitude: 37.5665, longitude: 126.978 }
const confirmedPoint = { latitude: 37.57, longitude: 126.99 }
const clerkUserId = 'bdd-us2-fan'

async function resetScenario(world: AtinyWorld) {
  await truncateProductTables(db)
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 10 where id = 1`
  world.clerkUserId = clerkUserId
}

async function selectLocation(world: AtinyWorld) {
  const address = '123 Private Street, Seoul'
  const query = { query: address, language: 'en' as const, limit: 5 }
  const handler = createLocationSuggestionsPostHandler({
    search: (input) => searchGeoapifyLocations(input, {
      apiKey: 'bdd-contract-key',
      fetch: async (url, init) => {
        const request = new URL(String(url))
        assert.equal(request.searchParams.get('text'), address)
        assert.equal(request.searchParams.get('bias'), 'countrycode:none')
        assert.equal(init?.headers && new Headers(init.headers).get('x-api-key'), 'bdd-contract-key')
        return Response.json({ results: [{
          city: 'Seoul', country: 'South Korea', country_code: 'kr',
          lat: point.latitude, lon: point.longitude, formatted: address,
        }] })
      },
    }),
    signSelection: (selection) => signLocationSelection(selection, selectionSecret),
  })
  const response = await handler(new Request('http://localhost/api/locations/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  }))
  assert.equal(response.status, 200)
  const body = await response.json() as { suggestions: Array<{ selectionToken: string; locality: string }> }
  assert.equal(body.suggestions.length, 1)
  assert.equal(body.suggestions[0].locality, 'Seoul')
  assert.ok(!JSON.stringify(body).includes(address))
  world.locationSelectionId = body.suggestions[0].selectionToken
  world.selectedAddress = address
}

async function publish(world: AtinyWorld, input: CreateMessageActionInput) {
  world.messageActionResult = await createMessageForSession(db, input, {
    readAuth: async () => ({ clerkUserId: world.clerkUserId! }),
    verifySelection: (token) => verifyLocationSelectionResult(token, selectionSecret),
  })
  if (world.messageActionResult.ok) world.publicId = world.messageActionResult.data.publicId
}

function approximateInput(world: AtinyWorld, content: string, recipient: 'ateez' | 'atiny' | null): CreateMessageActionInput {
  assert.ok(world.locationSelectionId)
  return { content, recipient, location: { selectionId: world.locationSelectionId, precision: 'approximate' } }
}

async function publicReads(publicId: string) {
  const features = await getMapFeatures(new Request('http://localhost/api/map/features?west=125&south=36&east=129&north=39&zoom=8'))
  const detail = await getPublicMessage(new Request(`http://localhost/api/messages/${publicId}`))
  return {
    features: await features.json() as { features?: Array<{ publicId: string }> },
    featuresStatus: features.status,
    detail: await detail.json() as Record<string, unknown>,
    detailStatus: detail.status,
  }
}

After({ tags: '@us2' }, async function () {
  await db`update app_private.settings set premoderation_enabled = false, message_limit = 10, cooldown_seconds = 10 where id = 1`
})

AfterAll(async function () {
  await db.end()
})

Given('una identidad Clerk con correo verificado y perfil incompleto', async function (this: AtinyWorld) {
  await resetScenario(this)
  this.clerkUser = {
    primaryEmailAddressId: 'bdd-email',
    emailAddresses: [{ id: 'bdd-email', verification: { status: 'verified' } }],
  }
})

Given('una fan activa con perfil completo', async function (this: AtinyWorld) {
  await resetScenario(this)
  await insertProfile(db, clerkUserId)
})

Given('una fan activa con perfil completo y moderación previa activada', async function (this: AtinyWorld) {
  await resetScenario(this)
  await insertProfile(db, clerkUserId)
  await db`update app_private.settings set premoderation_enabled = true where id = 1`
})

Given('una fan activa con diez mensajes no eliminados', async function (this: AtinyWorld) {
  await resetScenario(this)
  const profile = await insertProfile(db, clerkUserId)
  for (let index = 0; index < 10; index += 1) {
    await insertMessage(db, profile.id, { status: index % 2 === 0 ? 'withdrawn' : 'rejected', moderation_reason_code: 'fixture' })
  }
})

Given('una fan activa que acaba de publicar', async function (this: AtinyWorld) {
  await resetScenario(this)
  const profile = await insertProfile(db, clerkUserId)
  await insertMessage(db, profile.id)
})

When('publico {string} para {string} desde una ubicación aproximada', async function (this: AtinyWorld, content: string, recipient: 'ateez' | 'atiny') {
  await selectLocation(this)
  await publish(this, approximateInput(this, content, recipient))
})

When('intento publicar una ubicación precisa sin confirmar la advertencia', async function (this: AtinyWorld) {
  await selectLocation(this)
  await publish(this, {
    content: 'Punto preciso sin confirmar', recipient: null,
    location: { selectionId: this.locationSelectionId!, precision: 'precise', confirmedPublicPoint: confirmedPoint } as CreateMessageActionInput['location'],
  })
})

When('confirmo la advertencia y publico una ubicación precisa', async function (this: AtinyWorld) {
  await publish(this, {
    content: 'Punto preciso confirmado', recipient: null,
    location: { selectionId: this.locationSelectionId!, precision: 'precise', confirmedPublicPoint: confirmedPoint, preciseLocationConfirmed: true },
  })
})

When('intenta publicar otro mensaje válido', async function (this: AtinyWorld) {
  await selectLocation(this)
  await publish(this, approximateInput(this, 'El undécimo mensaje', 'atiny'))
})

When('intenta publicar antes del cooldown configurado', async function (this: AtinyWorld) {
  await selectLocation(this)
  await publish(this, approximateInput(this, 'Otra carta demasiado pronto', null))
})

Then('recibo un mensaje pendiente con enlace estable', async function (this: AtinyWorld) {
  assert.ok(this.profileActionResult?.ok)
  assert.ok(this.messageActionResult?.ok)
  assert.equal(this.messageActionResult.data.status, 'pending')
  assert.equal(this.messageActionResult.data.publicVisible, true)
  assert.match(this.messageActionResult.data.publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  const rows = await db<Array<{ content: string; location_precision: string; latitude: number; longitude: number }>>`
    select content, location_precision, ST_Y(public_point::geometry) as latitude, ST_X(public_point::geometry) as longitude
    from app_private.messages where public_id = ${this.publicId!}
  `
  assert.equal(rows.length, 1)
  assert.equal(rows[0].content, 'Siempre contigo')
  assert.equal(rows[0].location_precision, 'approximate')
  assert.ok(rows[0].latitude !== point.latitude || rows[0].longitude !== point.longitude)
  const reads = await publicReads(this.publicId!)
  assert.equal(reads.detailStatus, 200)
  assert.equal(reads.detail.publicId, this.publicId)
})

Then('la publicación se rechaza por ubicación no confirmada', async function (this: AtinyWorld) {
  assert.equal(this.messageActionResult?.ok, false)
  assert.ok(this.messageActionResult && !this.messageActionResult.ok)
  assert.equal(this.messageActionResult.error.code, 'LOCATION_SELECTION_REQUIRED')
  const rows = await db<Array<{ count: number }>>`select count(*)::int as count from app_private.messages`
  assert.equal(rows[0].count, 0)
})

Then('el punto público preciso no incluye la dirección escrita', async function (this: AtinyWorld) {
  assert.ok(this.messageActionResult?.ok)
  const rows = await db<Array<{ content: string; location_precision: string; latitude: number; longitude: number; country: string; locality: string | null; stored: string }>>`
    select content, location_precision, ST_Y(public_point::geometry) as latitude,
           ST_X(public_point::geometry) as longitude, country, locality, to_jsonb(m)::text as stored
    from app_private.messages m where public_id = ${this.publicId!}
  `
  assert.equal(rows.length, 1)
  assert.equal(rows[0].location_precision, 'precise')
  assert.equal(rows[0].latitude, confirmedPoint.latitude)
  assert.equal(rows[0].longitude, confirmedPoint.longitude)
  assert.ok(!rows[0].stored.includes(this.selectedAddress!))
})

Then('recibe el error {string} y acceso a {string}', async function (this: AtinyWorld, code: string, label: string) {
  assert.equal(this.messageActionResult?.ok, false)
  assert.ok(this.messageActionResult && !this.messageActionResult.ok)
  assert.equal(this.messageActionResult.error.code, code)
  assert.equal(this.messageActionResult.error.messageKey, 'message.limitReached')
  assert.equal(label, 'Mis mensajes')
  const rows = await db<Array<{ count: number }>>`select count(*)::int as count from app_private.messages`
  assert.equal(rows[0].count, 10)
})

Then('recibe el error {string} con segundos restantes', async function (this: AtinyWorld, code: string) {
  assert.equal(this.messageActionResult?.ok, false)
  assert.ok(this.messageActionResult && !this.messageActionResult.ok)
  assert.equal(this.messageActionResult.error.code, code)
  assert.ok((this.messageActionResult.error.retryAfterSeconds ?? 0) > 0)
  assert.ok((this.messageActionResult.error.retryAfterSeconds ?? 0) <= 10)
  const rows = await db<Array<{ count: number }>>`select count(*)::int as count from app_private.messages`
  assert.equal(rows[0].count, 1)
})

Then('el mensaje pendiente aparece en el mapa y abre su enlace estable', async function (this: AtinyWorld) {
  assert.ok(this.messageActionResult?.ok)
  assert.equal(this.messageActionResult.data.publicVisible, true)
  const reads = await publicReads(this.publicId!)
  assert.equal(reads.featuresStatus, 200)
  assert.ok(reads.features.features?.some((feature) => feature.publicId === this.publicId))
  assert.equal(reads.detailStatus, 200)
  assert.equal(reads.detail.publicId, this.publicId)
})

Then('el mensaje pendiente conserva su enlace estable pero no aparece públicamente', async function (this: AtinyWorld) {
  assert.ok(this.messageActionResult?.ok)
  assert.equal(this.messageActionResult.data.publicVisible, false)
  const rows = await db<Array<{ status: string }>>`select status from app_private.messages where public_id = ${this.publicId!}`
  assert.equal(rows[0].status, 'pending')
  const reads = await publicReads(this.publicId!)
  assert.equal(reads.featuresStatus, 200)
  assert.ok(!reads.features.features?.some((feature) => feature.publicId === this.publicId))
  assert.equal(reads.detailStatus, 404)
  const absent = await getPublicMessage(new Request('http://localhost/api/messages/00000000-0000-4000-8000-000000000000'))
  assert.deepEqual(await absent.json(), reads.detail)
})
