import { PublicHome } from './[lang]/page'
import { getDb } from '@/server/db/client'
import { listLatestHomepageMessages } from '@/server/messages/latest-public-messages'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const latestLetters = await listLatestHomepageMessages(getDb())
  return <PublicHome lang="en" latestLetters={latestLetters} />
}
