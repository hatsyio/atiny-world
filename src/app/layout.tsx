import type { Metadata } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'

import './globals.css'

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
})

const interfaceFont = Manrope({
  subsets: ['latin'],
  variable: '--font-interface',
})

export const metadata: Metadata = {
  title: 'ATINY World',
  description: 'A world of good wishes for ATEEZ.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${interfaceFont.variable}`}>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
