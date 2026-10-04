import type { Metadata } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { enUS, esES } from '@clerk/localizations'
import { NextIntlClientProvider } from 'next-intl'
import { getRequestLanguage } from '@/i18n/preference'
import { loadMessages } from '@/i18n/messages'
import { metadataBase } from '@/i18n/metadata-base'
import { LanguagePreferenceProvider } from '@/components/i18n/language-context'
import { LanguageSynchronizer } from '@/components/i18n/language-synchronizer'
import './globals.css'

const displayFont = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const interfaceFont = Manrope({ subsets: ['latin'], variable: '--font-interface' })

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestLanguage()
  const messages = await loadMessages(locale)
  return { metadataBase: metadataBase(), title: 'atiny world', description: messages.Settings.metadataDescription }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, preference } = await getRequestLanguage()
  const messages = await loadMessages(locale)
  return (
    <html lang={locale} className={`${displayFont.variable} ${interfaceFont.variable}`}>
      <body>
        <ClerkProvider localization={locale === 'es' ? esES : enUS}>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <LanguagePreferenceProvider preference={preference}>
              <LanguageSynchronizer />
              {children}
            </LanguagePreferenceProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
