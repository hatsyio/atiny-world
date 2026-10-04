'use client'

import type { Locale } from '@/i18n/locale'

import { useTranslations } from 'next-intl'

import { useEffect, useState } from 'react'

import type { PublicMessageDetail } from '@/domain/messages/public-message'

interface Props {
  requestUrl: string
  onSelect: (publicId: string) => void
  lang: Locale
}

export function MessageClusterList({ requestUrl, onSelect }: Props) {
  const [page, setPage] = useState<PublicMessageDetail[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(requestUrl, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('group unavailable')
        return response.json() as Promise<{ items: PublicMessageDetail[]; nextCursor: string | null }>
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setPage(result.items)
          setNextCursor(result.nextCursor)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [requestUrl, retry])

  async function loadMore() {
    if (!nextCursor || isLoading) return
    const url = new URL(requestUrl, window.location.origin)
    url.searchParams.set('cursor', nextCursor)
    setIsLoading(true)
    setError(false)
    try {
      const response = await fetch(`${url.pathname}?${url.searchParams.toString()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('group unavailable')
      const result = await response.json() as {
        items: PublicMessageDetail[]
        nextCursor: string | null
      }
      setPage((current) => [...current, ...result.items])
      setNextCursor(result.nextCursor)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const t = useTranslations('Map.cluster')
  function retryLoad() {
    setPage([])
    setNextCursor(null)
    setError(false)
    setIsLoading(true)
    setRetry((current) => current + 1)
  }

  return (
    <div className="cluster-list-wrap">
      {isLoading && page.length === 0 ? <p role="status">{t('loading')}</p> : null}
      {error ? <div role="status"><p>{t('unavailable')}</p><button type="button" onClick={retryLoad}>{t('retry')}</button></div> : null}
      {!isLoading && !error && page.length === 0 ? <p role="status">{t('empty')}</p> : null}
      {page.length > 0 ? (
        <ul className="cluster-list">
          {page.map((message) => (
            <li key={message.publicId} className="cluster-list__item">
              <button type="button" onClick={() => onSelect(message.publicId)}>
                <span className="cluster-list__content">{message.content}</span>
                <span className="cluster-list__meta">{[message.locality, message.country].filter(Boolean).join(', ')} · {message.author.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {nextCursor && !error ? <button className="cluster-list__more" type="button" disabled={isLoading} onClick={() => void loadMore()}>{t('more')}</button> : null}
    </div>
  )
}
