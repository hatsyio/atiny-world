import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'
import { AdminNavigation } from '@/components/admin/admin-navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  const t = await getTranslations('Pages.admin')
  return <main className="auth-page admin-page">
    <Link className="auth-back" href="/settings">{t('back')}</Link>
    <div className="admin-panel">
      <aside className="admin-sidebar">
        <h1>{t('title')}</h1>
        <AdminNavigation />
      </aside>
      <div className="admin-workspace">{children}</div>
    </div>
  </main>
}
