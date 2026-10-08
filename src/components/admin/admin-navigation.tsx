'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function AdminNavigation() {
  const t = useTranslations('Pages.admin')
  const pathname = usePathname()
  return <nav className="admin-navigation" aria-label={t('navigation')}>
    {(['messages', 'users', 'settings'] as const).map(section => <Link key={section} className={`admin-navigation__link admin-navigation__link--${section}`} href={`/admin/${section}`} aria-current={pathname === `/admin/${section}` ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {section === 'messages' ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></> : section === 'users' ? <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m3 9v-2a6 6 0 0 0-3-5" /></> : <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--admin-nav-background, #f7f3eb)" /><circle cx="15" cy="17" r="3" fill="var(--admin-nav-background, #f7f3eb)" /></>}
      </svg>
      <span>{t(section)}</span>
    </Link>)}
  </nav>
}
