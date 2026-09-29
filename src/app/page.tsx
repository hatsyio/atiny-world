import { PublicHome } from './[lang]/page'
import { getDb } from '@/server/db/client'
import { listLatestPublicMessages } from '@/server/messages/public-repository'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const latestLetters = await listLatestPublicMessages(getDb())
  return <PublicHome lang="en" latestLetters={latestLetters} />
}
