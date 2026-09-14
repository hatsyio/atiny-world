import assert from "node:assert/strict"

import { Given, Then, When } from "@cucumber/cucumber"

import { getPublicAppIdentity } from "../../../src/app-identity"
import {
  getSessionIdentity,
  type ClerkAuthReader,
  type SessionIdentity,
} from "../../../src/server/auth/session"
import { createHealthResponse } from "../../../src/server/db/health-response"

let actualName: string | undefined
let authReader: ClerkAuthReader | undefined
let sessionIdentity: SessionIdentity | null | undefined
let healthProbe: (() => Promise<{ database: "ok" }>) | undefined
let healthResponse: Response | undefined

When("consulto la identidad pública de la aplicación", function () {
  actualName = getPublicAppIdentity().name
})

Then("el nombre es {string}", function (expectedName: string) {
  assert.equal(actualName, expectedName)
})

Given("que Clerk no identifica a la visitante", function () {
  authReader = async () => ({ userId: null })
})

Given("que Clerk identifica a la fan como {string}", function (userId: string) {
  authReader = async () => ({ userId })
})

When("resuelvo la sesión en el servidor", async function () {
  assert.ok(authReader)
  sessionIdentity = await getSessionIdentity(authReader)
})

Then("la sesión es anónima", function () {
  assert.equal(sessionIdentity, null)
})

Then("la sesión pertenece a {string}", function (clerkUserId: string) {
  assert.deepEqual(sessionIdentity, { clerkUserId })
})

Given(
  "que la comprobación de PostgreSQL responde correctamente",
  function () {
    healthProbe = async () => ({ database: "ok" })
  },
)

Given("que la comprobación de PostgreSQL falla", function () {
  healthProbe = async () => {
    throw new Error("internal database details")
  }
})

When("consulto el estado HTTP de la base de datos", async function () {
  assert.ok(healthProbe)
  healthResponse = await createHealthResponse(healthProbe)
})

Then(
  "el estado HTTP es 200 y solo informa que la base de datos está disponible",
  async function () {
    assert.equal(healthResponse?.status, 200)
    assert.deepEqual(await healthResponse?.json(), { database: "ok" })
  },
)

Then(
  "el estado HTTP es 503 y no revela el error interno",
  async function () {
    assert.equal(healthResponse?.status, 503)
    assert.deepEqual(await healthResponse?.json(), { database: "unavailable" })
  },
)
