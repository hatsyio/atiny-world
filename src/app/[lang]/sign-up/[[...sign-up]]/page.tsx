import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export default async function SignUpPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const locale = lang === 'es' ? 'es' : 'en'
  return <main className="auth-page"><Link className="auth-back" href={`/${locale}`}>← {locale === 'es' ? 'Volver al mapa' : 'Back to the map'}</Link><div className="auth-panel"><p className="auth-script">Dear, ATEEZ…</p><h1>{locale === 'es' ? 'Únete al viaje' : 'Join the voyage'}</h1><SignUp /></div></main>
}
