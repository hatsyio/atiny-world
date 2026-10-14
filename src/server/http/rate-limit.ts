type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }
export type RateLimiter = (clientKey: string) => RateLimitResult

type RateLimitEntry = { windowStart: number; requests: number }

export function createFixedWindowRateLimiter(
  limit = 30,
  windowMs = 60_000,
  maxClients = 10_000,
  now: () => number = Date.now,
): RateLimiter {
  const entries = new Map<string, RateLimitEntry>()

  return (clientKey) => {
    const currentTime = now()
    const windowStart = Math.floor(currentTime / windowMs) * windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + windowMs - currentTime) / 1_000))
    const previous = entries.get(clientKey)

    if (previous?.windowStart === windowStart) {
      previous.requests += 1
      entries.delete(clientKey)
      entries.set(clientKey, previous)
      return { allowed: previous.requests <= limit, retryAfterSeconds }
    }

    if (!previous && entries.size >= maxClients) {
      const oldestClient = entries.keys().next().value
      if (oldestClient !== undefined) entries.delete(oldestClient)
    }

    entries.set(clientKey, { windowStart, requests: 1 })
    return { allowed: true, retryAfterSeconds }
  }
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const client = forwarded || request.headers.get('x-real-ip') || 'anonymous'
  return client.slice(0, 200)
}
