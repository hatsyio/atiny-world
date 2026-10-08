import {useTranslations, useFormatter} from 'next-intl'
import Link from 'next/link'

import { LetterLink } from '@/components/navigation/letter-link'

import { PublicMapController } from '@/components/map/public-map-controller'
import type { PublicMapFeature, PublicMessageDetail } from '@/domain/messages/public-message'
import { getPublicMessageStats, getVisibleMessage, type PublicMessageStats } from '@/server/messages/public-repository'
import { getDb } from '@/server/db/client'
import {
  listLatestHomepageMessages,
} from '@/server/messages/latest-public-messages'

export const dynamic = 'force-dynamic'



function locationLabel(message: PublicMessageDetail): string {
  return [message.locality, message.country].filter(Boolean).join(', ')
}

function countryFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('')
}

export function PublicHome({
  publicationPending = false,
  latestLetters = [],
  homepageStats = { letters: 0, countries: 0 },
  selectedMessage,
}: {
  publicationPending?: boolean
  latestLetters?: PublicMessageDetail[]
  homepageStats?: PublicMessageStats
  selectedMessage?: PublicMapFeature
}) {
  const t = useTranslations('Pages.home')
  const about = useTranslations('Pages.about')
  const format = useFormatter()
  const writeUrl = '/messages/new'

  return (
    <div className="voyage" id="home" tabIndex={-1}>
      <main>
        <section className="voyage-hero" aria-labelledby="public-home-title">
          <div className="hero-emblem" aria-hidden="true"><span className="hero-emblem__star">✦</span><span>ATEEZ</span></div>
          <div className="hero-message">
            <p className="script-title">{t('heroScript')}</p>
            <h1 id="public-home-title">{t('heroTitle')}</h1>
            <p className="hero-subtitle">{t('heroSub')}</p>
            <p className="hero-description">{t('heroText')}</p>
            <div className="hero-actions">
              <Link className="ornate-button" href={writeUrl}>{t('send')}</Link>
              <Link className="ornate-button" href="#map">{t('explore')}</Link>
            </div>
          </div>
        </section>

        <div className="paper-world">
          <div className="voyage-motto" aria-label={t('motto')}><span>{t('places')}</span><span>{t('sky')}</span><span>{t('oneAteez')}</span></div>
          <section className="world-intro" aria-label={t('journey')}>
            <div className="stat-plaque"><strong>{format.number(homepageStats.letters)}</strong><span>{t('letterStat', {count: homepageStats.letters})}</span></div>
            <div className="stat-plaque"><strong>{format.number(homepageStats.countries)}</strong><span>{t('countryStat', {count: homepageStats.countries})}</span></div>
            <div className="stat-plaque"><strong>8</strong><span>{t('piratesStat')}</span></div>
          </section>

          <section className="map-section" id="map" tabIndex={-1} aria-labelledby="map-title">
            <div className="map-heading"><h2 id="map-title">{t('mapTitle')}</h2><p>{t('mapNote')}</p></div>
            {publicationPending && <p className="profile-note" role="status">{t('publicationPending')}</p>}
            <p className="map-hint">{t('mapHint')}</p>
            <div className="live-map-frame"><PublicMapController selectedMessage={selectedMessage} /></div>
          </section>

          <section className="letters-section" id="letters" tabIndex={-1} aria-labelledby="letters-title">
            <div className="section-heading"><span className="section-rule" /><h2 id="letters-title">{t('lettersTitle')}</h2><span className="section-rule" /></div>
            <p className="letters-note">{t('lettersNote')}</p>
            <div className="letter-grid">
              {latestLetters.length === 0 ? <p role="status">{t('emptyLetters')}</p> : latestLetters.map((letter) => (
                <LetterLink className="letter-card" id={`letters-${letter.publicId}`} key={letter.publicId} publicId={letter.publicId} origin={`/#letters-${letter.publicId}`} aria-label={`${locationLabel(letter)} — ${letter.author.displayName}`}>
                  <div className="letter-place"><span role="img" aria-label={letter.country}>{countryFlag(letter.countryCode)}</span><span>{locationLabel(letter)}</span></div>
                  <p className="letter-body">{letter.content}</p>
                  <p className="letter-signature">— {letter.author.displayName}</p>
                  <span className="letter-seal" aria-hidden="true">✧</span>
                </LetterLink>
              ))}
            </div>
          </section>

          <section className="about-section" id="about" tabIndex={-1} aria-labelledby="about-title">
            <h2 id="about-title">{about('title')}</h2>
            <div className="about-layout">
              <div className="about-story">
                <h3>{about('projectTitle')}</h3>
                <p>{about('purpose')}</p>
                <p>{about('community')}</p>
                <p>{about('messages')}</p>
                <p>{about('origin')}</p>
              </div>
              <div className="about-credits">
                <h3 id="credits-title">{about('creditsTitle')}</h3>
                <ul aria-labelledby="credits-title">
                  <li><a href="https://www.threads.com/@angelppudding">@angelppudding</a><span>{about('idea')}</span></li>
                  <li><a href="https://www.threads.com/@breakthewalln109">@breakthewalln109</a><span>{about('support')}</span></li>
                  <li><a href="https://x.com/koala_hala">@koala_hala</a><span>{about('support')}</span></li>
                  <li><a href="https://joseppascual.com">Josep Pascual Badia</a><span>{about('development')}</span></li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section className="send-banner" aria-labelledby="send-title"><div><h2 id="send-title">{t('bannerTitle')}</h2><p>{t('bannerText')}</p></div><Link className="ornate-button" href={writeUrl}>{t('bannerAction')} <span aria-hidden="true">→</span></Link><span className="banner-seal" aria-hidden="true">✧</span></section>
      </main>
    </div>
  )
}

export default async function Page({ searchParams }: {
  searchParams: Promise<{ publication?: string; letter?: string }>
}) {
  const { publication, letter } = await searchParams
  const db = getDb()
  const [latestLetters, homepageStats, selectedLetter] = await Promise.all([
    listLatestHomepageMessages(db),
    getPublicMessageStats(db),
    typeof letter === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(letter) ? getVisibleMessage(db, letter) : Promise.resolve(null),
  ])
  const selectedMessage = selectedLetter ? {
    publicId: selectedLetter.publicId, point: selectedLetter.point, precision: selectedLetter.precision,
    locality: selectedLetter.locality, country: selectedLetter.country, countryCode: selectedLetter.countryCode,
    publishedAt: selectedLetter.publishedAt, author: selectedLetter.author,
  } : undefined
  return <PublicHome latestLetters={latestLetters} homepageStats={homepageStats} selectedMessage={selectedMessage} publicationPending={publication === 'pending'} />
}
