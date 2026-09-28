'use server'

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export async function recoverUsername(locale: 'en' | 'es', formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) redirect(`/${locale}/sign-in`)

  const user = await currentUser()
  if (!user || user.id !== userId) redirect(`/${locale}/sign-in`)
  if (user.username) redirect(`/${locale}/auth/continue`)

  const value = formData.get('username')
  const username = typeof value === 'string' ? value.trim() : ''
  if (username.length < 4 || username.length > 64) {
    redirect(`/${locale}/profile?error=invalid`)
  }

  try {
    const client = await clerkClient()
    await client.users.updateUser(userId, { username })
  } catch {
    redirect(`/${locale}/profile?error=unavailable`)
  }

  redirect(`/${locale}/auth/continue`)
}
