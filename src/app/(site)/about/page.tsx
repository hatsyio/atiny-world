import Link from 'next/link'
import {useTranslations} from 'next-intl'

export default function AboutPage() {
  const about = useTranslations('Pages.about')
  const navigation = useTranslations('Navigation')

  return (
    <main className="paper-world about-page">
      <Link className="about-back" href="/#map">{navigation('backMap')}</Link>
      <section className="about-section" aria-labelledby="about-title">
        <h1 id="about-title">{about('title')}</h1>
        <div className="about-layout">
          <div className="about-story">
            <h2>{about('projectTitle')}</h2>
            <p>{about('purpose')}</p>
            <p>{about('community')}</p>
            <p>{about('messages')}</p>
            <p>{about('origin')}</p>
          </div>
          <div className="about-credits">
            <h2 id="credits-title">{about('creditsTitle')}</h2>
            <ul aria-labelledby="credits-title">
              <li><a href="https://www.threads.com/@angelppudding">@angelppudding</a><span>{about('idea')}</span></li>
              <li><a href="https://www.threads.com/@breakthewalln109">@breakthewalln109</a><span>{about('support')}</span></li>
              <li><a href="https://x.com/koala_hala">@koala_hala</a><span>{about('support')}</span></li>
              <li><a href="https://x.com/hatsyio">@hatsyio</a><span>{about('development')}</span></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
