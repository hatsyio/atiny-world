import { SiteHeader } from '@/components/navigation/site-header'
import { SiteFooter } from '@/components/navigation/site-footer'

export default async function LocalizedLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return <div className="site-shell" lang={locale}><SiteHeader lang={locale} />{children}<SiteFooter lang={locale} /></div>
}
