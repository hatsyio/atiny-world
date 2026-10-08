'use client'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

export function SiteFooter() {
  const t = useTranslations('Navigation')
  return (
    <footer className="site-footer">
      <p className="footer-script">{t('script')}</p>
      <p>{t('footer')}</p>
      <p className="footer-motto">{t('motto')}</p>
      <p><Link href="/about">{t('about')}</Link></p>
      <p>{t('developedBy')} <a href="https://x.com/hatsyio">@hatsyio</a></p>
    </footer>
  )
}
