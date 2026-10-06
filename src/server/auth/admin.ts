import { notFound } from 'next/navigation'
import { authorizeSession } from './authorize'
import { getDb } from '@/server/db/client'

export async function requireAdminPage() {
  const result = await authorizeSession(getDb())
  if (!result.ok || (result.data.role !== 'admin' && result.data.role !== 'owner')) notFound()
  return result.data
}
