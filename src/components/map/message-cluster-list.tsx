'use client'

import { useTranslations } from 'next-intl'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { isInvalidMapCursor, mapMessagesQuery } from './map-queries'

interface Props {
  requestUrl: string
  selectedPublicId?: string
  showLoadedCount?: boolean
  keepPreviousViewport?: boolean
  onSelect: (publicId: string) => void
}

export function MessageClusterList({ requestUrl, onSelect, selectedPublicId, showLoadedCount, keepPreviousViewport }: Props) {
  const queryClient = useQueryClient()
  const options = mapMessagesQuery(requestUrl)
  const query = useInfiniteQuery({
    ...options,
    placeholderData: (previous, previousQuery) => {
      const previousUrl = previousQuery?.queryKey[2]
      if (!keepPreviousViewport || typeof previousUrl !== 'string') return undefined
      const before = new URLSearchParams(previousUrl.split('?')[1])
      const after = new URLSearchParams(requestUrl.split('?')[1])
      if (before.get('city') === after.get('city') && before.get('country') === after.get('country')) return previous
      return undefined
    },
  })
  const page = query.isError && !query.isFetchNextPageError ? [] : query.data?.pages.flatMap(page => page.items) ?? []
  const t = useTranslations('Map.cluster')
  const isLoading = query.isPending
  const error = query.isError
  function retryLoad() {
    if (isInvalidMapCursor(query.error)) void queryClient.resetQueries({ queryKey: options.queryKey, exact: true })
    else if (query.isFetchNextPageError) void query.fetchNextPage()
    else void query.refetch()
  }

  return (
    <div className="cluster-list-wrap">
      {isLoading && page.length === 0 ? <p role="status">{t('loading')}</p> : null}
      {query.isPlaceholderData ? <p role="status">{t('loading')}</p> : null}
      {error ? <div role="status"><p>{t('unavailable')}</p><button type="button" onClick={retryLoad}>{t('retry')}</button></div> : null}
      {!isLoading && !error && page.length === 0 ? <p role="status">{t('empty')}</p> : null}
      {showLoadedCount && page.length > 0 ? <p className="cluster-list__count" role="status">{t('loaded', { count: page.length })}</p> : null}
      {page.length > 0 ? (
        <ul className="cluster-list">
          {page.map((message) => (
            <li key={message.publicId} className="cluster-list__item">
              <button type="button" aria-pressed={selectedPublicId === message.publicId} onClick={() => onSelect(message.publicId)}>
                <span className="cluster-list__content">{message.content}</span>
                <span className="cluster-list__meta">{[message.locality, message.country].filter(Boolean).join(', ')} · {message.author.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.hasNextPage && !error ? <button className="cluster-list__more" type="button" disabled={query.isFetching} onClick={() => { if (!query.isFetching) void query.fetchNextPage() }}>{t('more')}</button> : null}
    </div>
  )
}
