'use server'

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { authRoute } from '@/server/auth/auth-destination'

export async function recoverUsername(locale: 'en' | 'es', formData: FormData): Promise<void> {
  const next = formData.get('next')
  const signIn = authRoute(locale, 'sign-in', next)
  const continuation = authRoute(locale, 'auth/continue', next)
  const profile = authRoute(locale, 'profile', next)
  const pendingQuery = profile.includes('?') ? `&${profile.split('?')[1]}` : ''
  const { userId } = await auth()
  if (!userId) redirect(signIn)

  const user = await currentUser()
  if (!user || user.id !== userId) redirect(signIn)
  if (user.username) redirect(continuation)

  const value = formData.get('username')
  const username = typeof value === 'string' ? value.trim() : ''
  if (username.length < 4 || username.length > 64) {
    redirect(`/profile?error=invalid${pendingQuery}`)
  }

  try {
    const client = await clerkClient()
    await client.users.updateUser(userId, { username })
  } catch {
    redirect(`/profile?error=unavailable${pendingQuery}`)
  }

  redirect(continuation)
}
