import { auth } from '@clerk/nextjs/server'

export type SessionIdentity = {
  clerkUserId: string
}

export type ClerkAuthReader = () => Promise<{ userId: string | null }>

export async function getSessionIdentity(
  readAuth: ClerkAuthReader = auth,
): Promise<SessionIdentity | null> {
  const { userId } = await readAuth()

  return userId ? { clerkUserId: userId } : null
}
