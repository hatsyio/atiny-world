import { authRoute, type AuthSearchParams } from '@/server/auth/auth-destination'
import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'

export default async function SignUpPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<AuthSearchParams> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  const { next } = await searchParams
  const continuation = authRoute(locale, 'auth/continue', next)
  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}#map`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link>
      <div className="clerk-auth-step">
        <SignUp
          signInUrl={authRoute(locale, 'sign-in', next)}
          forceRedirectUrl={continuation}
          signInForceRedirectUrl={continuation}
        />
      </div>
    </main>
  )
}
