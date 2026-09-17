import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

import { PublicMapController } from '@/components/map/public-map-controller'

export function PublicHome({ lang }: { lang: 'en' | 'es' }) {
  const copy = lang === 'es'
    ? { title: 'Un mundo de buenos deseos para ATEEZ', intro: 'Mensajes de ATINY, sin importar la distancia.', publish: 'Publicar un mensaje', contact: 'Contacto y normas' }
    : { title: 'A world of good wishes for ATEEZ', intro: 'Messages from ATINY, across every distance.', publish: 'Publish a message', contact: 'Contact and guidelines' }

  return (
    <>
      <header className="site-header" aria-label="Account header">
        <Link className="wordmark" href={`/${lang}`}>ATINY World</Link>
        <nav className="account-actions" aria-label="Account">
          <Show when="signed-out"><SignInButton><button type="button">Sign in</button></SignInButton><SignUpButton><button type="button">Join</button></SignUpButton></Show>
          <Show when="signed-in"><UserButton /></Show>
        </nav>
      </header>
      <main>
        <section aria-labelledby="public-home-title">
          <p>{copy.intro}</p>
          <h1 id="public-home-title">{copy.title}</h1>
          <PublicMapController />
          <Link href={`/${lang}/sign-up`}>{copy.publish}</Link>
        </section>
      </main>
      <footer><Link href={`/${lang}/contact`}>{copy.contact}</Link></footer>
    </>
  )
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <PublicHome lang={lang === 'es' ? 'es' : 'en'} />
}
