import { SiteHeader } from '@/components/navigation/site-header'
import { SiteFooter } from '@/components/navigation/site-footer'
import { PublicHome } from './[lang]/page'
import { getDb } from '@/server/db/client'
import {
  getHomepageStats,
  listLatestHomepageMessages,
} from '@/server/messages/latest-public-messages'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = getDb()
  const [latestLetters, homepageStats] = await Promise.all([
    listLatestHomepageMessages(db),
    getHomepageStats(db),
  ])
  return <div className="site-shell" lang="en"><SiteHeader lang="en" /><PublicHome lang="en" latestLetters={latestLetters} homepageStats={homepageStats} /><SiteFooter lang="en" /></div>
}
