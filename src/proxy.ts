import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isLocalizedPath, isApiPath } from '@/server/http/locale'

export default clerkMiddleware((_auth, request: NextRequest) => {
  const { pathname, search } = request.nextUrl

  if (isApiPath(pathname)) {
    return NextResponse.next()
  }

  if (!isLocalizedPath(pathname)) {
    const target = request.nextUrl.clone()
    target.pathname = `/en${pathname === '/' ? '' : pathname}`
    target.search = search
    return NextResponse.redirect(target, 308)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}