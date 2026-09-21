'use client'

import { useRouter } from 'next/navigation'

import { CreateMessageForm, type CreateMessageSubmit } from './create-message-form'

export function CreateMessageFlow({
  lang,
  submitMessage,
}: {
  lang: 'en' | 'es'
  submitMessage?: CreateMessageSubmit
}) {
  const router = useRouter()

  function onPublished(publicId: string, publicVisible: boolean) {
    window.dispatchEvent(new Event('atiny:message-published'))
    router.refresh()
    if (publicVisible) {
      router.push(`/${lang}/messages/${publicId}`)
    } else {
      router.push(`/${lang}?publication=pending#map`)
    }
  }

  return <CreateMessageForm lang={lang} submitMessage={submitMessage} onPublished={onPublished} />
}
