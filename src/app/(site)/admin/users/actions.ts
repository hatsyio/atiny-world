'use server'

import { revalidatePath } from 'next/cache'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { setAdministratorRole, setSuspension } from '@/server/moderation/accounts'
import { captureServerEvent } from '@/server/observability/posthog'

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
  await captureServerEvent(identity.clerkUserId, 'administrator_role_updated', { role })
  revalidatePath('/admin', 'layout')
  revalidatePath('/settings')
  return { status: 'saved' }
}

export type SuspensionActionState = { status: 'idle' | 'saved' | 'denied' | 'invalid' | 'conflict' | 'error' }

export async function setSuspensionAction(_previous: SuspensionActionState, form: FormData): Promise<SuspensionActionState> {
  const identity = await getSessionIdentity()
  if (!identity) return { status: 'denied' }
  const publicId = form.get('publicId')
  const suspended = form.get('suspended')
  const roleVersion = form.get('expectedRoleVersion')
  const suspensionVersion = form.get('expectedSuspensionVersion')
  const reasonCode = form.get('reasonCode')
  const note = form.get('note')
  const validVersion = (value: FormDataEntryValue | null): value is string => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) < 2147483647
  if (typeof publicId !== 'string' || (suspended !== 'true' && suspended !== 'false')
    || !validVersion(roleVersion) || !validVersion(suspensionVersion) || form.get('confirmed') !== 'on'
    || (reasonCode !== null && typeof reasonCode !== 'string') || (note !== null && typeof note !== 'string')) return { status: 'invalid' }
  try {
    const result = await setSuspension(getDb(), {
      clerkUserId: identity.clerkUserId, publicId, suspended: suspended === 'true',
      expectedRoleVersion: Number(roleVersion), expectedSuspensionVersion: Number(suspensionVersion),
      ...(reasonCode !== null ? { reasonCode } : {}), ...(note !== null ? { note } : {}),
    })
    if (!result.ok) return { status: result.error.code === 'MESSAGE_VERSION_CONFLICT' ? 'conflict' : result.error.code === 'VALIDATION_ERROR' ? 'invalid' : 'denied' }
  } catch { return { status: 'error' } }
  await captureServerEvent(identity.clerkUserId, 'account_suspension_updated', {
    suspended: suspended === 'true',
  })
  revalidatePath('/', 'layout')
  return { status: 'saved' }
}
