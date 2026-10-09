import { getTranslations } from 'next-intl/server'
import { LettersArchive } from '@/components/messages/letters-archive'
import { readLetterExploration } from '@/components/messages/letter-exploration'
import { getDb } from '@/server/db/client'
import { listPublicLetterCountries, pagePublicLetters } from '@/server/messages/public-repository'

export const dynamic = 'force-dynamic'

export default async function LettersPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const criteria = readLetterExploration(await searchParams)
  const db = getDb()
  const [page, countries] = await Promise.all([pagePublicLetters(db, criteria), listPublicLetterCountries(db)])
  return <LettersArchive criteria={{ ...criteria, page: page.page }} countries={countries} page={page} />
}

export async function generateMetadata() {
  const t = await getTranslations('Pages.letters')
  return { title: t('title'), description: t('intro'), alternates: { canonical: '/letters' } }
}
