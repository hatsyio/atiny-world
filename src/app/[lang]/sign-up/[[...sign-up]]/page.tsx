import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'

export default async function SignUpPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link>
      <div className="clerk-auth-step">
        <SignUp
          signInUrl={`/${locale}/sign-in`}
          fallbackRedirectUrl={`/${locale}/auth/continue`}
          signInFallbackRedirectUrl={`/${locale}/auth/continue`}
        />
      </div>
    </main>
  )
}
