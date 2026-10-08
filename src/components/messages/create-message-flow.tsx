'use client'

import type { Locale } from '@/i18n/locale'

import { useQueryClient } from '@tanstack/react-query'
import { publicMapQueryKey } from '@/components/map/map-queries'

import { useRouter } from 'next/navigation'

import { CreateMessageForm, type CreateMessageSubmit } from './create-message-form'

export function CreateMessageFlow({
  lang,
  submitMessage,
  returnTo,
}: {
  lang: Locale
  returnTo?: string
  submitMessage?: CreateMessageSubmit
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  function onPublished(publicId: string, publicVisible: boolean) {
    void queryClient.resetQueries({ queryKey: publicMapQueryKey })
    router.refresh()
    if (publicVisible) {
      router.push(`/messages/${publicId}`)
    } else {
      router.push('/?publication=pending#map')
    }
  }

  return <CreateMessageForm lang={lang} returnTo={returnTo} submitMessage={submitMessage} onPublished={onPublished} />
}
