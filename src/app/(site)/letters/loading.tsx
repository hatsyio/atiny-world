import { getTranslations } from 'next-intl/server'

export default async function Loading() {
  const t = await getTranslations('Pages.letters')
  return <main className="letters-archive" aria-busy="true"><p role="status">{t('loading')}</p></main>
}
