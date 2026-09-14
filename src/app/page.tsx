import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs'
import Link from 'next/link'

import { getPublicAppIdentity } from '@/app-identity'

export default function Home() {
  const { name } = getPublicAppIdentity()

  return (
    <main className="shell">
      <header className="site-header" aria-label="Site header">
        <Link className="wordmark" href="/" aria-label={`${name}, home`}>
          <span aria-hidden="true">✦</span>
          {name}
        </Link>
        <nav className="account-actions" aria-label="Account">
          <Show when="signed-out">
            <SignInButton>
              <button className="text-action" type="button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="primary-action" type="button">
                Join the map
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="intro">Messages from ATINY, across every distance.</p>
          <h1 id="hero-title">A world of good wishes for ATEEZ</h1>
          <p className="summary">
            Leave a message where you are and discover the constellation we
            create together.
          </p>
          <p className="status">The first map is being charted now.</p>
        </div>

        <div className="globe" role="img" aria-label="Abstract world map grid">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="star star-one">✦</span>
          <span className="star star-two">✦</span>
          <span className="star star-three">✦</span>
          <span className="route" />
        </div>
      </section>
    </main>
  )
}
