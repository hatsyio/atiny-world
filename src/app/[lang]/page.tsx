import { Show, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

import { PublicMapController } from '@/components/map/public-map-controller'
import type { PublicMessageDetail } from '@/domain/messages/public-message'
import { getDb } from '@/server/db/client'
import { listLatestPublicMessages } from '@/server/messages/public-repository'

export const dynamic = 'force-dynamic'

const copy = {
  en: {
    home: 'Home', send: 'Send a letter', explore: 'Explore the map', letters: 'Letters', about: 'About', signIn: 'Sign in', join: 'Join',
    heroScript: 'Dear, ATEEZ…', heroTitle: 'Messages across the seas', heroSub: 'From ATINY around the world, to ATEEZ.', heroText: 'Leave a message of love, encouragement, or appreciation and add your voice to our global map.',
    mapTitle: 'A global ocean of ATINY', mapNote: 'Different lands. Same love. Always ATEEZ.', mapHint: 'Explore the map and find letters from around the world.',
    lettersTitle: 'Letters from ATINY', lettersNote: 'Recent messages shared publicly by ATINY around the world.', emptyLetters: 'No public letters yet. Be the first to share one.', greeting: 'Dear ATEEZ,',
    bannerTitle: 'Send your letter', bannerText: 'Share your message, mark your location, and be part of this journey.', bannerAction: 'Write your letter',
    footer: 'An independent fan project by ATINY, for ATEEZ. Not affiliated with or endorsed by KQ Entertainment.',
    publicationPending: 'Your letter was sent. It is pending moderation and will appear on the map once approved.',
  },
  es: {
    home: 'Inicio', send: 'Envía una carta', explore: 'Explora el mapa', letters: 'Cartas', about: 'Sobre el proyecto', signIn: 'Entrar', join: 'Únete',
    heroScript: 'Querido ATEEZ…', heroTitle: 'Mensajes a través de los mares', heroSub: 'De ATINY de todo el mundo, para ATEEZ.', heroText: 'Deja un mensaje de cariño, ánimo o agradecimiento y suma tu voz a nuestro mapa global.',
    mapTitle: 'Un océano global de ATINY', mapNote: 'Tierras distintas. El mismo cariño. Siempre ATEEZ.', mapHint: 'Explora el mapa y encuentra cartas de todo el mundo.',
    lettersTitle: 'Cartas de ATINY', lettersNote: 'Mensajes públicos recientes compartidos por ATINY de todo el mundo.', emptyLetters: 'Todavía no hay cartas públicas. Sé la primera persona en compartir una.', greeting: 'Querido ATEEZ,',
    bannerTitle: 'Envía tu carta', bannerText: 'Comparte tu mensaje, marca tu lugar y forma parte de este viaje.', bannerAction: 'Escribe tu carta',
    footer: 'Un proyecto independiente de fans, de ATINY para ATEEZ. Sin afiliación ni respaldo de KQ Entertainment.',
    publicationPending: 'Tu carta se ha enviado. Está pendiente de moderación y aparecerá en el mapa en cuanto sea aprobada.',
  },
} as const

function locationLabel(message: PublicMessageDetail): string {
  return [message.locality, message.country].filter(Boolean).join(', ')
}

export function PublicHome({
  lang,
  publicationPending = false,
  latestLetters = [],
}: {
  lang: 'en' | 'es'
  publicationPending?: boolean
  latestLetters?: PublicMessageDetail[]
}) {
  const t = copy[lang]
  const writeUrl = `/${lang}/messages/new`

  return (
    <div className="voyage" id="home">
      <header className="site-header" aria-label="Site header">
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="#home">{t.home}</Link>
          <Link href={writeUrl}>{t.send}</Link>
          <Link href="#map">{t.explore}</Link>
          <Link href="#letters">{t.letters}</Link>
          <Link href="#about">{t.about}</Link>
        </nav>
        <Link className="nav-brand" href={`/${lang}`} aria-label="atiny world, home">
          <span className="nav-compass" aria-hidden="true">✧</span>
          <span>ATINY <i>•</i> FOR ATEEZ <i>•</i> ACROSS EVERY SEA</span>
        </Link>
        <nav className="account-actions" aria-label="Account">
          <Show when="signed-out"><Link href={`/${lang}/sign-in`}>{t.signIn}</Link><Link href={`/${lang}/sign-up`}>{t.join}</Link></Show>
          <Show when="signed-in"><UserButton /></Show>
        </nav>
      </header>

      <main>
        <section className="voyage-hero" aria-labelledby="public-home-title">
          <div className="hero-emblem" aria-hidden="true"><span className="hero-emblem__star">✦</span><span>ATEEZ</span></div>
          <div className="hero-message">
            <p className="script-title">{t.heroScript}</p>
            <h1 id="public-home-title">{t.heroTitle}</h1>
            <p className="hero-subtitle">{t.heroSub}</p>
            <p className="hero-description">{t.heroText}</p>
            <div className="hero-actions">
              <Link className="ornate-button" href={writeUrl}>{t.send}</Link>
              <Link className="ornate-button" href="#map">{t.explore}</Link>
            </div>
          </div>
        </section>

        <div className="paper-world">
          <div className="voyage-motto" aria-label="Different places, same sky, one ATEEZ"><span>Different places</span><span>Same sky</span><span>One ATEEZ</span></div>
          <section className="world-intro" aria-label="Our shared journey">
            <div className="stat-plaque"><strong>One</strong><span>world</span></div>
            <div className="stat-plaque"><strong>Many</strong><span>places</span></div>
            <div className="stat-plaque"><strong>One</strong><span>ATEEZ</span></div>
          </section>

          <section className="map-section" id="map" aria-labelledby="map-title">
            <div className="map-heading"><h2 id="map-title">{t.mapTitle}</h2><p>{t.mapNote}</p></div>
            {publicationPending && <p className="profile-note" role="status">{t.publicationPending}</p>}
            <p className="map-hint">{t.mapHint}</p>
            <div className="live-map-frame"><PublicMapController lang={lang} /></div>
          </section>

          <section className="letters-section" id="letters" aria-labelledby="letters-title">
            <div className="section-heading"><span className="section-rule" /><h2 id="letters-title">{t.lettersTitle}</h2><span className="section-rule" /></div>
            <p className="letters-note">{t.lettersNote}</p>
            <div className="letter-grid">
              {latestLetters.length === 0 ? <p role="status">{t.emptyLetters}</p> : latestLetters.map((letter) => (
                <Link className="letter-card" key={letter.publicId} href={`/${lang}/messages/${letter.publicId}`} aria-label={`${locationLabel(letter)} — ${letter.author.displayName}`}>
                  <div className="letter-place"><span aria-hidden="true">✉</span><span>{locationLabel(letter)}</span></div>
                  <p className="letter-greeting">{t.greeting}</p>
                  <p className="letter-body">{letter.content} <span aria-hidden="true">♡</span></p>
                  <p className="letter-signature">— {letter.author.displayName}</p>
                  <span className="letter-seal" aria-hidden="true">✧</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section className="send-banner" aria-labelledby="send-title"><div><h2 id="send-title">{t.bannerTitle}</h2><p>{t.bannerText}</p></div><Link className="ornate-button" href={writeUrl}>{t.bannerAction} <span aria-hidden="true">→</span></Link><span className="banner-seal" aria-hidden="true">✧</span></section>
      </main>
      <footer className="site-footer" id="about"><p className="footer-script">Dear, ATEEZ…</p><p>{t.footer}</p><p className="footer-motto">DIFFERENT PLACES <span>•</span> SAME SKY <span>•</span> ONE ATEEZ</p></footer>
    </div>
  )
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ publication?: string }>
}) {
  const { lang } = await params
  const { publication } = await searchParams
  const locale = lang === 'es' ? 'es' : 'en'
  const latestLetters = await listLatestPublicMessages(getDb())
  return <PublicHome lang={locale} latestLetters={latestLetters} publicationPending={publication === 'pending'} />
}
