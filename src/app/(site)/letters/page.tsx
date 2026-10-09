import { getTranslations } from 'next-intl/server'
import { LettersArchive } from '@/components/messages/letters-archive'
import { readLetterExploration } from '@/components/messages/letter-exploration'
import { getDb } from '@/server/db/client'
import { listPublicLetterLocations, pagePublicLetters } from '@/server/messages/public-repository'

export const dynamic = 'force-dynamic'

export default async function LettersPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const criteria = readLetterExploration(await searchParams)
  const db = getDb()
  const [page, locations] = await Promise.all([pagePublicLetters(db, criteria), listPublicLetterLocations(db)])
  return <LettersArchive criteria={{ ...criteria, page: page.page }} countries={[...new Set(locations.map(location => location.country))]} locations={locations} page={page} />
}

export async function generateMetadata() {
  const t = await getTranslations('Pages.letters')
  return { title: t('title'), description: t('intro'), alternates: { canonical: '/letters' } }
}
