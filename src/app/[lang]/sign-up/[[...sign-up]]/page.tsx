import Link from 'next/link'
import { SignUpWithPublicName } from '@/components/account/sign-up-with-public-name'

export default async function SignUpPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return (
    <main className="auth-page">
      <Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link>
      <div className="auth-panel">
        <p className="auth-script">Dear, ATEEZ…</p>
        <h1>{locale === 'es' ? 'Únete a atiny world' : 'Join atiny world'}</h1>
        <p className="profile-intro">{locale === 'es'
          ? 'Clerk gestiona el registro. Durante esta prueba, Google puede mostrar accounts.dev y los correos incluyen [Development].'
          : 'Clerk manages sign-up. During this test, Google may show accounts.dev and emails include [Development].'}</p>
        <SignUpWithPublicName lang={locale} />
      </div>
    </main>
  )
}
