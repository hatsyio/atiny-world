import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isLocalizedPath, isApiPath, stripLegacyLocale } from '@/server/http/locale'

export default clerkMiddleware((_auth, request: NextRequest) => {
  const { pathname, search } = request.nextUrl

  if (isApiPath(pathname) || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  if (isLocalizedPath(pathname)) {
    const target = request.nextUrl.clone()
    target.pathname = stripLegacyLocale(pathname)
    target.search = search
    return NextResponse.redirect(target, 307)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Missing assets render the root not-found layout, which also reads Clerk auth.
    // File extensions cannot safely distinguish assets from those render requests.
    '/((?!_next/).*)',
    '/(api|trpc)(.*)',
  ],
}
