import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireAdminPage } from '@/server/auth/admin'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { getAdminSettings } from '@/server/moderation/settings'
import { AdminSettingsControl } from '@/components/admin/settings-control'

export default async function AdminSettingsPage() {
  await requireAdminPage()
  const identity = await getSessionIdentity()
  if (!identity) notFound()
  const result = await getAdminSettings(getDb(), identity.clerkUserId)
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound()
    const t = await getTranslations('Pages.admin')
    return <p role="alert">{t('invalid')}</p>
  }
  const t = await getTranslations('Pages.admin.settingsPanel')
  return <section className="admin-section admin-section--settings" aria-labelledby="admin-settings-title">
    <header className="admin-section-header">
    <h2 id="admin-settings-title">{t('title')}</h2>
    <p>{t('intro')}</p>
    </header>
    <AdminSettingsControl settings={result.data} />
  </section>
}
