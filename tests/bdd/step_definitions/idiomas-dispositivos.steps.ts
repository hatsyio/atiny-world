import assert from 'node:assert/strict'
import { AfterAll, Given, Then, When } from '@cucumber/cucumber'
import { resolveLanguage, type LanguagePreference } from '../../../src/i18n/locale'
import { readLanguagePreference, saveLanguagePreferenceForSession } from '../../../src/server/auth/language-preference'
import { normalizeInternalDestination } from '../../../src/server/http/locale'
import { createTestDb, insertProfile } from '../../support/database'
import { AtinyWorld } from '../support/world'

type Input = Parameters<typeof resolveLanguage>[0]
type State = { input: Input; locale?: string; destination?: string; userId?: string }
const states = new WeakMap<AtinyWorld, State>()
const db = createTestDb()
function state(world: AtinyWorld): State {
  let current = states.get(world)
  if (!current) { current = { input: { userId: null } }; states.set(world, current) }
  return current
}
AfterAll(async () => { await db.end() })

Given('un navegador que solicita los idiomas {string}', function (this: AtinyWorld, header: string) {
  state(this).input.acceptLanguage = header
})
Given('una elección de visitante {string}', function (this: AtinyWorld, preference: string) {
  state(this).input.visitorCookie = preference
})
Given('una cuenta con preferencia de idioma {string}', function (this: AtinyWorld, preference: LanguagePreference) {
  state(this).input.userId = 'reader'
  state(this).input.profilePreference = preference
})
When('resuelvo el idioma de la interfaz para la visitante', function (this: AtinyWorld) {
  state(this).locale = resolveLanguage(state(this).input).locale
})
When('resuelvo el idioma de la interfaz para la cuenta', function (this: AtinyWorld) {
  state(this).locale = resolveLanguage(state(this).input).locale
})
When('la visitante vuelve a Automático', function (this: AtinyWorld) {
  state(this).input.visitorCookie = undefined
  state(this).locale = resolveLanguage(state(this).input).locale
})
Then('la interfaz utiliza el idioma {string}', function (this: AtinyWorld, locale: string) {
  assert.equal(state(this).locale, locale)
})
Given('una fan que guarda el idioma {string} en su perfil', async function (this: AtinyWorld, preference: LanguagePreference) {
  const userId = `bdd-language-${crypto.randomUUID()}`
  await insertProfile(db, userId)
  assert.equal(await saveLanguagePreferenceForSession(db, preference, async () => ({ clerkUserId: userId })), true)
  state(this).userId = userId
})
Given('otro dispositivo con navegador {string} y sin cookies', function (this: AtinyWorld, header: string) {
  state(this).input = { userId: state(this).userId!, acceptLanguage: header }
})
When('recupero la preferencia de idioma de esa fan', async function (this: AtinyWorld) {
  const current = state(this)
  current.input.profilePreference = await readLanguagePreference(db, current.userId!)
  current.locale = resolveLanguage(current.input).locale
})
When('abro el destino histórico {string}', function (this: AtinyWorld, path: string) {
  state(this).destination = normalizeInternalDestination(path)
  state(this).locale = resolveLanguage(state(this).input).locale
})
Then('el destino normalizado es {string}', function (this: AtinyWorld, expected: string) {
  assert.equal(state(this).destination, expected)
})
