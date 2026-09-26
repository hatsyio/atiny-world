import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default async function SignInPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link>
      <div className="auth-panel">
        <p className="auth-script">Dear, ATEEZ…</p>
        <h1>{locale === 'es' ? 'Entra en atiny world' : 'Sign in to atiny world'}</h1>
        <p className="profile-intro">{locale === 'es'
          ? 'Clerk gestiona el acceso. Durante esta prueba, Google puede mostrar accounts.dev y los correos incluyen [Development].'
          : 'Clerk manages sign-in. During this test, Google may show accounts.dev and emails include [Development].'}</p>
        <SignIn signUpUrl={`/${locale}/sign-up`} fallbackRedirectUrl={`/${locale}/auth/continue`} />
      </div>
    </main>
  )
}
