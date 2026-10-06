import {SiteHeader} from '@/components/navigation/site-header'
import {SiteFooter} from '@/components/navigation/site-footer'
import {getSessionIdentity} from '@/server/auth/session'
import {authorizeProfile} from '@/server/auth/authorize'
import {getDb} from '@/server/db/client'

export default async function SiteLayout({children}: {children: React.ReactNode}) {
  const identity = await getSessionIdentity()
  const profile = identity ? await authorizeProfile(getDb(), identity) : null
  const canAdminister = !!profile?.ok && (profile.data.role === 'admin' || profile.data.role === 'owner')
  return <div className="site-shell"><SiteHeader canAdminister={canAdminister} />{children}<SiteFooter /></div>
}
