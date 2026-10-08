import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { searchModerationMessages } from '@/server/moderation/message-repository'
import { MESSAGE_STATUSES } from '@/domain/contracts'
import { MessageQueue } from '@/components/admin/message-queue'

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }> }) {
  await requireAdminPage()
  const identity = await getSessionIdentity()
  if (!identity) notFound()
  const params = await searchParams
  const t = await getTranslations('Pages.admin.moderation')
  const pagination = await getTranslations('Pages.admin')
  const states = await getTranslations('Forms.own.status')
  if (Array.isArray(params.q) || Array.isArray(params.status) || Array.isArray(params.page)) return <p role="alert">{t('invalid')}</p>
  const query = params.q ?? ''
  const status = params.status ?? 'pending'
  const page = params.page === undefined ? 1 : Number(params.page)
  const result = await searchModerationMessages(getDb(), identity.clerkUserId, { query, status, page })
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound()
    return <p role="alert">{t('invalid')}</p>
  }
  const href = (number: number) => `/admin/messages?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&page=${number}`
  const format = await getFormatter()
  // Intl punctuation can differ between Node and iOS, even for the same UTC date.
  const messages = result.data.items.map(message => ({
    ...message,
    publishedAtLabel: format.dateTime(new Date(message.publishedAt), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }),
  }))
  return <section aria-labelledby="admin-messages-title">
    <h2 id="admin-messages-title">{t('title')}</h2>
    <p>{t('intro')}</p>
    <form className="admin-search admin-message-search" action="/admin/messages" method="get">
      <label htmlFor="admin-message-query">{t('searchLabel')}</label>
      <div><input id="admin-message-query" name="q" type="search" maxLength={100} defaultValue={query} /><button type="submit">{pagination('search')}</button></div>
      <label htmlFor="admin-message-state">{t('state')}</label>
      <select id="admin-message-state" name="status" defaultValue={status}>
        <option value="all">{t('all')}</option>
        {MESSAGE_STATUSES.map(value => <option key={value} value={value}>{states(value)}</option>)}
      </select>
    </form>
    <MessageQueue messages={messages} />
    <nav className="admin-pagination" aria-label={t('pagination')}>
      {page > 1 && <Link href={href(page - 1)}>{pagination('previous')}</Link>}
      {result.data.hasMore && <Link href={href(page + 1)}>{pagination('next')}</Link>}
    </nav>
  </section>
}
