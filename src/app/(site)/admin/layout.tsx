import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  const t = await getTranslations('Pages.admin')
  return <main className="auth-page admin-page">
    <Link className="auth-back" href="/settings">{t('back')}</Link>
    <div className="auth-panel admin-panel">
      <h1>{t('title')}</h1>
      <nav aria-label={t('navigation')}><Link href="/admin/messages">{t('messages')}</Link><Link href="/admin/users">{t('users')}</Link></nav>
      {children}
    </div>
  </main>
}
