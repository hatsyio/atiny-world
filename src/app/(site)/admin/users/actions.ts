'use server'

import { revalidatePath } from 'next/cache'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { setAdministratorRole } from '@/server/moderation/accounts'

export type RoleActionState = { status: 'idle' | 'saved' | 'denied' | 'invalid' | 'conflict' | 'error' }

export async function setAdministratorRoleAction(_previous: RoleActionState, form: FormData): Promise<RoleActionState> {
  const identity = await getSessionIdentity()
  if (!identity) return { status: 'denied' }
  const publicId = form.get('publicId')
  const role = form.get('role')
  const expectedRole = form.get('expectedRole')
  const version = form.get('expectedRoleVersion')
  if (typeof publicId !== 'string' || typeof role !== 'string' || typeof expectedRole !== 'string' || typeof version !== 'string' || !/^[1-9]\d*$/.test(version)) return { status: 'invalid' }
  const expectedRoleVersion = Number(version)
  try {
    const result = await setAdministratorRole(getDb(), { clerkUserId: identity.clerkUserId, publicId, role, expectedRole, expectedRoleVersion })
    if (!result.ok) return { status: result.error.messageKey === 'admin.conflict' ? 'conflict' : result.error.code === 'VALIDATION_ERROR' ? 'invalid' : 'denied' }
  } catch { return { status: 'error' } }
  revalidatePath('/admin', 'layout')
  revalidatePath('/settings')
  return { status: 'saved' }
}
