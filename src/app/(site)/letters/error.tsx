'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function Error({ reset }: { reset: () => void }) {
  const t = useTranslations('Pages.letters')
  return <main className="letters-archive"><p role="alert">{t('error')}</p><button className="profile-submit" type="button" onClick={reset}>{t('retry')}</button> <Link href="/letters">{t('clear')}</Link></main>
}
