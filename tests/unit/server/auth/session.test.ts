import { describe, expect, it } from "vitest"

import { getSessionIdentity } from "../../../../src/server/auth/session"

describe("getSessionIdentity", () => {
  it("returns null when Clerk has no authenticated user", async () => {
    const identity = await getSessionIdentity(async () => ({ userId: null }))

    expect(identity).toBeNull()
  })

  it("returns the Clerk user id for an authenticated session", async () => {
    const identity = await getSessionIdentity(async () => ({
      userId: "user_123",
    }))

    expect(identity).toEqual({ clerkUserId: "user_123" })
  })
})
