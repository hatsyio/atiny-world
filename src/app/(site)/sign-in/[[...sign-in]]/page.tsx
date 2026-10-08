import {getLocale, getTranslations} from 'next-intl/server'
import { authRoute, type AuthSearchParams } from '@/server/auth/auth-destination'
import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default async function SignInPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  const locale = await getLocale()
  const { next } = await searchParams
  const continuation = authRoute(locale, 'auth/continue', next)
  return (
    <main className="auth-page">
      <Link className="auth-back" href={'/#map'}>← {(await getTranslations('Navigation'))('backMap')}</Link>
      <div className="clerk-auth-step">
        <SignIn signUpUrl={authRoute(locale, 'sign-up', next)} forceRedirectUrl={continuation} signUpForceRedirectUrl={continuation} />
      </div>
    </main>
  )
}
