'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isModerationReasonCode } from '@/i18n/moderation-reasons'

export function SuspensionNotice({ reasonCode }: { reasonCode: string | null }) {
  const t = useTranslations('Pages.suspensionNotice')
  const reasons = useTranslations('Forms.own')
  return <aside role="status" className="suspension-notice">
    <p><strong>{t('title')}</strong></p>
    <p>{isModerationReasonCode(reasonCode) ? reasons(`reasons.${reasonCode}`) : reasons('reasonFallback')}</p>
    <p>{t('explanation')}</p>
    <Link href="/my-messages">{t('ownLetters')}</Link>
  </aside>
}
