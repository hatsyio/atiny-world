'use client'
import {useTranslations} from 'next-intl'

export function SiteFooter() {
  const t = useTranslations('Navigation')
  return (
    <footer className="site-footer" id="about">
      <p className="footer-script">{t('script')}</p>
      <p>{t('footer')}</p>
      <p className="footer-motto">{t('motto')}</p>
      <p>{t('developedBy')} <a href="https://joseppascual.com">Josep Pascual</a></p>
    </footer>
  )
}
