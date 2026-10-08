'use client'

import { useTransition, type ReactNode, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLoading } from './admin-loading'

export function AdminSearchForm({ action, className, children }: { action: string; className: string; children: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === 'string') params.append(key, value)
    startTransition(() => router.push(`${action}?${params.toString()}`))
  }
  return <form action={action} method="get" className={className} onSubmit={search} aria-busy={pending}>
    {children}
    {pending && <AdminLoading />}
  </form>
}
