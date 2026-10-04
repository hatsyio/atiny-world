import { navigationCopy } from './copy'

export function SiteFooter({ lang }: { lang: 'en' | 'es' }) {
  const t = navigationCopy[lang]
  return (
    <footer className="site-footer" id="about">
      <p className="footer-script">Dear, ATEEZ…</p>
      <a href="#about">{t.about}</a>
      <p>{t.footer}</p>
      <p className="footer-motto">DIFFERENT PLACES <span>•</span> SAME SKY <span>•</span> ONE ATEEZ</p>
    </footer>
  )
}
