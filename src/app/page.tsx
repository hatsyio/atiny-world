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
  return <PublicHome lang="en" latestLetters={latestLetters} homepageStats={homepageStats} />
}
