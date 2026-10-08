import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/server/auth/admin'

export default async function AdminPage() {
  await requireAdminPage()
  redirect('/admin/messages')
}
