'use client'

import Form from 'next/form'
import Link from 'next/link'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { LetterLink } from '@/components/navigation/letter-link'
import { AppSelect } from '@/components/ui/app-select'
import type { PublicMessagePage } from '@/server/messages/public-repository'
import { lettersHref, type LetterExploration } from './letter-exploration'

export function LettersArchive({ criteria, countries, page }: {
  criteria: LetterExploration
  countries: string[]
  page: PublicMessagePage
}) {
  const t = useTranslations('Pages.letters')
  const locale = useLocale()
  const format = useFormatter()
  const regions = new Intl.DisplayNames([locale], { type: 'region' })
  const countryName = (code: string) => regions.of(code.toUpperCase()) ?? code.toUpperCase()
  const options = [...new Set([...countries, ...(criteria.country ? [criteria.country] : [])])]
    .map(value => ({ value, label: countryName(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const active = [criteria.q, criteria.country ? countryName(criteria.country) : '', criteria.city].filter(Boolean)
  return <main className="letters-archive">
    <header className="letters-archive__heading">
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
    </header>
    <Form action="/letters" className="letters-archive__filters" key={lettersHref(criteria)}>
      <label>{t('search')}<input type="search" name="q" maxLength={200} defaultValue={criteria.q} /></label>
      <AppSelect label={t('country')} name="country" variant="paper" defaultValue={criteria.country || ''} options={[{ value: '', label: t('allCountries') }, ...options]} />
      <label>{t('city')}<input type="text" name="city" maxLength={100} defaultValue={criteria.city} /></label>
      <button type="submit" className="profile-submit">{t('apply')}</button>
    </Form>
    <div className="letters-archive__context">
      {active.length ? <p>{t('active', { criteria: active.join(', ') })}</p> : <p>{t('recent')}</p>}
      <Link href="/letters">{t('clear')}</Link>
    </div>
    {page.items.length === 0 ? <p role="status" className="letters-archive__empty">{t('empty')}</p> :
      <div className="letters-archive__list">{page.items.map(letter => <article className="archive-letter" id={`letter-${letter.publicId}`} key={letter.publicId}>
        <header><p>{[letter.locality, countryName(letter.countryCode)].filter(Boolean).join(', ')}</p>
          <time dateTime={letter.publishedAt}>{format.dateTime(new Date(letter.publishedAt), { dateStyle: 'long', timeZone: 'UTC' })}</time></header>
        <p className="archive-letter__text">{letter.content}</p>
        <footer><p>{letter.author.displayName}</p><LetterLink publicId={letter.publicId} origin={lettersHref(criteria, letter.publicId)} aria-label={t('readBy', { name: letter.author.displayName })}>{t('read')}</LetterLink></footer>
      </article>)}</div>}
    <nav className="letters-archive__pagination" aria-label={t('pagination')}>
      {criteria.cursor ? <Link href={lettersHref({ ...criteria, cursor: undefined })}>{t('first')}</Link> : null}
      {page.nextCursor ? <Link href={lettersHref({ ...criteria, cursor: page.nextCursor })}>{t('older')}</Link> : null}
    </nav>
  </main>
}
