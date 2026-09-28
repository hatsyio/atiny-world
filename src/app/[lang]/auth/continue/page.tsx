import { redirect } from 'next/navigation'

import { resolveAccountGate } from '@/server/auth/account-gate'
import { getDb } from '@/server/db/client'

export default async function ContinueAfterAuth({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const gate = await resolveAccountGate(getDb())
  if (gate.kind === 'anonymous') redirect(`/${locale}/sign-in`)
  if (gate.kind === 'incomplete') redirect(`/${locale}/profile`)
  redirect(`/${locale}/messages/new`)
}
