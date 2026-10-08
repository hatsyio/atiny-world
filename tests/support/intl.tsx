import { MapQueryProvider } from '@/components/map/map-query-provider'
import { NextIntlClientProvider } from 'next-intl'
import { render as testingRender, type RenderOptions } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import enForms from '@/i18n/messages/en/forms.json'
import esForms from '@/i18n/messages/es/forms.json'
import enMap from '@/i18n/messages/en/map.json'
import esMap from '@/i18n/messages/es/map.json'
import enNavigation from '@/i18n/messages/en/navigation.json'
import esNavigation from '@/i18n/messages/es/navigation.json'
import enPages from '@/i18n/messages/en/pages.json'
import esPages from '@/i18n/messages/es/pages.json'
import enSettings from '@/i18n/messages/en/settings.json'
import esSettings from '@/i18n/messages/es/settings.json'
const messages = { en: { Forms: enForms, Map: enMap, Navigation: enNavigation, Pages: enPages, Settings: enSettings }, es: { Forms: esForms, Map: esMap, Navigation: esNavigation, Pages: esPages, Settings: esSettings } }

export function IntlTestProvider({ children, locale = 'en' }: {children: ReactNode; locale?: 'en' | 'es'}) {
  return <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC"><MapQueryProvider>{children}</MapQueryProvider></NextIntlClientProvider>
}

export function render(ui: ReactElement, options?: RenderOptions) {
  const props = isValidElement<{lang?: string}>(ui) ? ui.props : {}
  const locale = props.lang === 'es' ? 'es' : 'en'
  return testingRender(ui, { wrapper: ({children}) => <IntlTestProvider locale={locale}>{children}</IntlTestProvider>, ...options })
}
