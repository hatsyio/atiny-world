'use client'

import { useTranslations } from 'next-intl'

export type ShareFeedback = {kind:'success' | 'error' | 'manual'; message:string; value?:string} | null
export function LetterShareFeedback({feedback}: {feedback:ShareFeedback}) {
  const t = useTranslations('Forms.share')
  if (!feedback) return null
  return <div className="letter-share-feedback">
    <p role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p>
    {feedback.kind === 'manual' ? <label>{t('manual')}<textarea aria-label={t('manual')} value={feedback.value} readOnly onFocus={event => event.currentTarget.select()} /></label> : null}
  </div>
}
export async function copyShareValue(value: string, success: string, fallback: string, update: (feedback:ShareFeedback) => void) {
  try {
    await navigator.clipboard.writeText(value)
    update({kind:'success', message:success})
  } catch {
    update({kind:'manual', message:fallback, value})
  }
}
export function wasShareCancelled(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}
