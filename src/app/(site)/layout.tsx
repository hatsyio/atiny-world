import {SuspensionNotice} from '@/components/account/suspension-notice'
import {readOwnSuspensionReason} from '@/server/accounts/suspension'
import {SiteHeader} from '@/components/navigation/site-header'
import {SiteFooter} from '@/components/navigation/site-footer'
import {getSessionIdentity} from '@/server/auth/session'
import {authorizeProfile} from '@/server/auth/authorize'
import {getDb} from '@/server/db/client'

export default async function SiteLayout({children}: {children: React.ReactNode}) {
  const identity = await getSessionIdentity()
  const profile = identity ? await authorizeProfile(getDb(), identity) : null
  const canAdminister = !!profile?.ok && (profile.data.role === 'admin' || profile.data.role === 'owner')
  const suspended = !!identity && !!profile && !profile.ok && profile.error.messageKey === 'account.suspended'
  const reasonCode = suspended ? await readOwnSuspensionReason(getDb(), identity!.clerkUserId) : null
  return <div className="site-shell"><SiteHeader canAdminister={canAdminister} />{suspended && <SuspensionNotice reasonCode={reasonCode} />}{children}<SiteFooter /></div>
}
