'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { PublicMessageDetail } from '@/domain/messages/public-message'

interface Props {
  items: PublicMessageDetail[] | import('@/domain/messages/public-message').PublicMapFeature[]
  onSelect: (publicId: string) => void
  requestUrl?: string
}

export function MessageClusterList({ items, onSelect, requestUrl }: Props) {
  const [page, setPage] = useState(items)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!requestUrl) return
    const controller = new AbortController()
    void fetch(requestUrl, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('group unavailable')
        return response.json() as Promise<{ items: typeof items; nextCursor: string | null }>
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setPage(result.items)
          setNextCursor(result.nextCursor)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [items, requestUrl])

  async function loadMore() {
    if (!requestUrl || !nextCursor || isLoading) return
    const url = new URL(requestUrl, window.location.origin)
    url.searchParams.set('cursor', nextCursor)
    setIsLoading(true)
    try {
      const response = await fetch(`${url.pathname}?${url.searchParams.toString()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('group unavailable')
      const result = await response.json() as {
        items: typeof items
        nextCursor: string | null
      }
      setPage((current) => [...current, ...result.items])
      setNextCursor(result.nextCursor)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
    <ul className="cluster-list">
      {page.map((feature) => (
        <li key={feature.publicId} className="cluster-list__item">
          <Link href={`/en/messages/${feature.publicId}`}>
            <button
              type="button"
              onClick={() => onSelect(feature.publicId)}
            >
              {feature.author.displayName}
            </button>
          </Link>
        </li>
      ))}
    </ul>
    {nextCursor ? (
      <button type="button" disabled={isLoading} onClick={() => void loadMore()}>
        Cargar más mensajes
      </button>
    ) : null}
    </div>
  )
}
