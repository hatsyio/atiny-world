import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { searchAccounts } from '@/server/moderation/accounts'
import { SuspensionControl } from '@/components/admin/suspension-control'
import { RoleControl } from '@/components/admin/role-control'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdminPage()
  const identity = await getSessionIdentity()
  if (!identity) notFound()
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q : ''
  const page = typeof params.page === 'string' ? Number(params.page) : 1
  const result = await searchAccounts(getDb(), identity.clerkUserId, query, page)
  const t = await getTranslations('Pages.admin')
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound()
    return <p role="alert">{t('invalid')}</p>
  }
  const href = (number: number) => `/admin/users?q=${encodeURIComponent(query)}&page=${number}`
  return <section aria-labelledby="admin-users-title">
    <h2 id="admin-users-title">{t('users')}</h2>
    <p>{t(result.data.actorRole === 'owner' ? 'ownerIntro' : 'adminIntro')}</p>
    <form className="admin-search" action="/admin/users" method="get">
      <label htmlFor="admin-query">{t('searchLabel')}</label>
      <div><input id="admin-query" name="q" type="search" maxLength={100} defaultValue={query} /><button type="submit">{t('search')}</button></div>
    </form>
    {result.data.items.length === 0 ? <p role="status">{t('empty')}</p> : <ul className="admin-users">
      {result.data.items.map(account => <li key={account.publicId}>
        <div><h3>{account.displayName}</h3><p>{t(`roles.${account.role}`)} · {t(`states.${account.state}`)}</p><small>{t('accountId')}: {account.publicId}</small></div>
        <div className="admin-account-controls">
          {result.data.actorRole === 'owner' && account.role !== 'owner' && account.state !== 'deletion_pending' ? <RoleControl account={account} /> : null}
          {account.state !== 'deletion_pending' && (account.role === 'fan' || (account.role === 'admin' && result.data.actorRole === 'owner')) ? <SuspensionControl account={account} /> : null}
        </div>
      </li>)}
    </ul>}
    <nav className="admin-pagination" aria-label={t('pagination')}>
      {page > 1 && <Link href={href(page - 1)}>{t('previous')}</Link>}
      {result.data.hasMore && <Link href={href(page + 1)}>{t('next')}</Link>}
    </nav>
  </section>
}
