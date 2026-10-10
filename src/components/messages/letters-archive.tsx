'use client'

import Link from 'next/link'
import type { PublicLetterLocation } from '@/domain/location/public-locations'
import { AppCityInput } from '@/components/ui/app-city-input'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { LetterLink } from '@/components/navigation/letter-link'
import { AutoFilterForm, AutoFilterInput } from '@/components/ui/auto-filter-form'
import { mapCountries } from '@/i18n/countries'
import { AppSelect } from '@/components/ui/app-select'
import type { PublicLetterPage } from '@/server/messages/public-repository'
import { lettersHref, type LetterExploration } from './letter-exploration'

function countryFlag(code: string): string {
  return /^[a-z]{2}$/i.test(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map(char => char.charCodeAt(0) + 127397))
    : ''
}

export function LettersArchive({ criteria, countries, locations = [], page }: {
  criteria: LetterExploration
  countries: string[]
  locations?: PublicLetterLocation[]
  page: PublicLetterPage
}) {
  const t = useTranslations('Pages.letters')
  const locale = useLocale()
  const format = useFormatter()
  const catalog = mapCountries[locale]
  const countryName = (code: string) => catalog.find(country => country.value === code.toLowerCase())?.label ?? code.toUpperCase()
  const available = new Set(countries)
  const options = catalog.filter(country => available.has(country.value))
    .map(({ value, label }) => ({ value, label: `${countryFlag(value)} ${label}` }))
  const pages = [...new Set([1, page.totalPages, ...Array.from({ length: 5 }, (_, index) => page.page + index - 2)])]
    .filter(number => number >= 1 && number <= page.totalPages).sort((a, b) => a - b)
  return <main className="letters-archive">
    <header className="letters-archive__heading">
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
    </header>
    <AutoFilterForm action="/letters" className="letters-archive__filters" values={{ q: criteria.q ?? '', country: criteria.country ?? '', city: criteria.city ?? '' }} loadingLabel={t('loading')}>
      <label>{t('search')}<AutoFilterInput type="search" name="q" maxLength={200} /></label>
      <AppSelect label={t('country')} placeholder={t('countryUnavailable')} name="country" variant="paper" options={[{ value: '', label: t('allCountries') }, ...options]} />
      <AppCityInput label={t('city')} locations={locations} />
    </AutoFilterForm>
    {page.items.length === 0 ? <p role="status" className="letters-archive__empty">{t('empty')}</p> :
      <div className="letters-archive__list">{page.items.map(letter => <article className="archive-letter" id={`letter-${letter.publicId}`} key={letter.publicId}>
        <header><p><span aria-hidden="true">{countryFlag(letter.countryCode)}</span>{' '}{[letter.locality, countryName(letter.countryCode)].filter(Boolean).join(', ')}</p>
          <time dateTime={letter.publishedAt}>{format.dateTime(new Date(letter.publishedAt), { dateStyle: 'long', timeZone: 'UTC' })}</time></header>
        <p className="archive-letter__text">{letter.content}</p>
        <footer><p>{letter.author.displayName}</p><LetterLink publicId={letter.publicId} origin={lettersHref(criteria, letter.publicId)} aria-label={t('readBy', { name: letter.author.displayName })}>{t('read')}</LetterLink></footer>
      </article>)}</div>}
    {page.totalPages > 1 ? <nav className="letters-archive__pagination" aria-label={t('pagination')}>
      {page.page > 1 ? <Link href={lettersHref({ ...criteria, page: page.page - 1 })} rel="prev">{t('previous')}</Link> : <span aria-disabled="true">{t('previous')}</span>}
      {pages.map((number, index) => <span className="letters-archive__page" key={number}>
        {index > 0 && number - pages[index - 1] > 1 ? <span className="letters-archive__ellipsis" aria-hidden="true">…</span> : null}
        <Link href={lettersHref({ ...criteria, page: number })} aria-label={t('page', { number })} aria-current={number === page.page ? 'page' : undefined}>{number}</Link>
      </span>)}
      {page.page < page.totalPages ? <Link href={lettersHref({ ...criteria, page: page.page + 1 })} rel="next">{t('next')}</Link> : <span aria-disabled="true">{t('next')}</span>}
    </nav> : null}
  </main>
}
