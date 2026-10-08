import {getLocale, getTranslations} from 'next-intl/server'
import { authRoute, type AuthSearchParams } from '@/server/auth/auth-destination'
import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'

export default async function SignUpPage({ searchParams }: { searchParams: Promise<AuthSearchParams> }) {
  const locale = await getLocale()
  const { next } = await searchParams
  const continuation = authRoute(locale, 'auth/continue', next)
  return (
    <main className="auth-page">
      <Link className="auth-back" href={'/#map'}>← {(await getTranslations('Navigation'))('backMap')}</Link>
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
