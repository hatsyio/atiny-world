import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EditMessageForm } from '@/components/messages/edit-message-form'
import { resolveAccountGate } from '@/server/auth/account-gate'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { pageOwnMessages } from '@/server/messages/own-message-repository'

const copy = {
  en: { back: 'Back to your messages', script: 'Dear, ATEEZ…', title: 'Edit your letter' },
  es: { back: 'Volver a tus mensajes', script: 'Querido ATEEZ…', title: 'Editar tu carta' },
} as const

export default async function EditOwnMessagePage({
  params,
}: {
  params: Promise<{ lang: string; publicId: string }>
}) {
  const { lang, publicId } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const t = copy[locale]
  const db = getDb()
  const gate = await resolveAccountGate(db)

  if (gate.kind === 'anonymous') redirect(`/${locale}/sign-in`)
  if (gate.kind === 'incomplete') redirect(`/${locale}/profile`)
  if (gate.kind !== 'allowed') redirect(`/${locale}/my-messages`)

  const identity = await getSessionIdentity()
  if (!identity) redirect(`/${locale}/sign-in`)

  // This owner-only query prevents an administrator or another account from
  // loading someone else's text into the edit form.
  const page = await pageOwnMessages(db, { clerkUserId: identity.clerkUserId, limit: 100 })
  const message = page.items.find((item) => item.publicId === publicId)
  if (!message) notFound()

  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}/my-messages`}>← {t.back}</Link>
      <div className="auth-panel my-messages-panel">
        <p className="auth-script">{t.script}</p>
        <h1>{t.title}</h1>
        <EditMessageForm lang={locale} message={message} />
      </div>
    </main>
  )
}
