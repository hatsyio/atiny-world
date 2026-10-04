import {SiteHeader} from '@/components/navigation/site-header'
import {SiteFooter} from '@/components/navigation/site-footer'

export default function SiteLayout({children}: {children: React.ReactNode}) {
  return <div className="site-shell"><SiteHeader />{children}<SiteFooter /></div>
}
