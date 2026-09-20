import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default async function SignInPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return <main className="auth-page"><Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link><div className="auth-panel"><p className="auth-script">Dear, ATEEZ…</p><h1>{locale === 'es' ? 'Vuelve a bordo' : 'Welcome aboard'}</h1><SignIn /></div></main>
}
