import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { PublicMapFeature, PublicMessageDetail } from '@/domain/messages/public-message'

export const publicMapQueryKey = ['public-map'] as const

class PublicMapRequestError extends Error {
  constructor(readonly status: number, readonly invalidCursor = false) { super(`Public map request failed: ${status}`) }
}

export function isInvalidMapCursor(error: unknown): boolean {
  return error instanceof PublicMapRequestError && error.invalidCursor
}

async function readPublicJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) {
    const body = response.status === 400 ? await response.json().catch(() => null) : null
    throw new PublicMapRequestError(response.status, body?.fieldErrors?.cursor === 'pagination.cursorInvalid')
  }
  return response.json() as Promise<T>
}

// Public visibility may change remotely. Keep no inactive data and revalidate
// on mount, focus, reconnect and every 30 seconds while a view is visible.
const publicQueryPolicy = {
  staleTime: 0,
  gcTime: 0,
  refetchInterval: 30_000,
  retry: (failureCount: number, error: Error) => failureCount < 1 &&
    (!(error instanceof PublicMapRequestError) || error.status >= 500),
}

export function mapFeaturesQuery(requestUrl: string) {
  return queryOptions({
    ...publicQueryPolicy,
    queryKey: [...publicMapQueryKey, 'features', requestUrl],
    queryFn: ({ signal }) => readPublicJson<{ features: PublicMapFeature[] }>(requestUrl, signal),
  })
}

export function publicMessageQuery(publicId: string) {
  return queryOptions({
    ...publicQueryPolicy,
    queryKey: [...publicMapQueryKey, 'detail', publicId],
    queryFn: ({ signal }) => readPublicJson<PublicMessageDetail>(`/api/messages/${encodeURIComponent(publicId)}`, signal),
  })
}

export function mapMessagesQuery(requestUrl: string) {
  return infiniteQueryOptions({
    ...publicQueryPolicy,
    queryKey: [...publicMapQueryKey, 'messages', requestUrl],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const url = new URL(requestUrl, 'https://atiny.invalid')
      if (pageParam) url.searchParams.set('cursor', pageParam)
      return readPublicJson<{ items: PublicMessageDetail[]; nextCursor: string | null }>(`${url.pathname}${url.search}`, signal)
    },
    getNextPageParam: lastPage => lastPage.nextCursor,
  })
}
