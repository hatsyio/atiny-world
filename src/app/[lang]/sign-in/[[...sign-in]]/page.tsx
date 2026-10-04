import { authRoute, type AuthSearchParams } from '@/server/auth/auth-destination'
import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default async function SignInPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<AuthSearchParams> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const { next } = await searchParams
  const continuation = authRoute(locale, 'auth/continue', next)
  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}#map`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link>
      <div className="clerk-auth-step">
        <SignIn signUpUrl={authRoute(locale, 'sign-up', next)} forceRedirectUrl={continuation} signUpForceRedirectUrl={continuation} />
      </div>
    </main>
  )
}
