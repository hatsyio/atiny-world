import {getLocale} from 'next-intl/server'
import { authRoute, authDestination, type AuthSearchParams } from '@/server/auth/auth-destination'
import { redirect } from 'next/navigation'

import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

export default async function ContinueAfterAuth({ searchParams }: { params?: Promise<{lang?: string}>; searchParams: Promise<AuthSearchParams> }) {
  const locale = await getLocale()
  const { next } = await searchParams
  const gate = await resolveAccountGate(getDb())
  if (gate.kind === 'anonymous') redirect(authRoute(locale, 'sign-in', next))
  if (gate.kind !== 'allowed') redirect(authRoute(locale, 'profile', next))
  redirect(authDestination(locale, next))
}
