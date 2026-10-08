import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { searchAccounts } from '@/server/moderation/accounts'
import { SuspensionControl } from '@/components/admin/suspension-control'
import { AdminDisclosure } from '@/components/admin/admin-disclosure'
import { RoleControl } from '@/components/admin/role-control'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const actor = await requireAdminPage()
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
  return <section className="admin-section admin-section--users" aria-labelledby="admin-users-title">
    <header className="admin-section-header">
    <h2 id="admin-users-title">{t('users')}</h2>
    <p>{t(result.data.actorRole === 'owner' ? 'ownerIntro' : 'adminIntro')}</p>
    </header>
    <form className="admin-search" action="/admin/users" method="get">
      <label htmlFor="admin-query">{t('searchLabel')}</label>
      <div><input id="admin-query" name="q" type="search" maxLength={100} defaultValue={query} /><button type="submit">{t('search')}</button></div>
    </form>
    {result.data.items.length === 0 ? <p role="status">{t('empty')}</p> : <ul className="admin-users">
      {result.data.items.map(account => {
        const canChangeRole = account.publicId !== actor.publicId && account.role !== 'owner' && account.state !== 'deletion_pending'
        const canSuspend = account.state !== 'deletion_pending' && (account.role === 'fan' || (account.role === 'admin' && result.data.actorRole === 'owner'))
        return <li key={account.publicId}>
          <div className="admin-account-summary">
            <h3>{account.displayName}</h3>
            <p className="admin-badges"><span className="admin-badge">{t(`roles.${account.role}`)}</span><span className="admin-badge" data-state={account.state}>{t(`states.${account.state}`)}</span></p>
            <small>{t('accountId')}: {account.publicId}</small>
          </div>
          {(canChangeRole || canSuspend) && <AdminDisclosure label={t('manage')} context={account.displayName}>
            <div className="admin-account-controls">
              {canChangeRole && <section><h4>{t('permissions')}</h4><RoleControl account={account} /></section>}
              {canSuspend && <section><h4>{t('accountAccess')}</h4><SuspensionControl account={account} /></section>}
            </div>
          </AdminDisclosure>}
        </li>
      })}
    </ul>}
    <nav className="admin-pagination" aria-label={t('pagination')}>
      {page > 1 && <Link href={href(page - 1)}>{t('previous')}</Link>}
      {result.data.hasMore && <Link href={href(page + 1)}>{t('next')}</Link>}
    </nav>
  </section>
}
