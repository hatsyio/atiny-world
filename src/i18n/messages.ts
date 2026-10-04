import type { Locale } from './locale'
import type { Messages } from './types'
import enNavigation from './messages/en/navigation.json'
import enPages from './messages/en/pages.json'
import enMap from './messages/en/map.json'
import enForms from './messages/en/forms.json'
import enSettings from './messages/en/settings.json'
import esNavigation from './messages/es/navigation.json'
import esPages from './messages/es/pages.json'
import esMap from './messages/es/map.json'
import esForms from './messages/es/forms.json'
import esSettings from './messages/es/settings.json'

const catalogs: Record<Locale, Messages> = {
  en: { Navigation: enNavigation, Pages: enPages, Map: enMap, Forms: enForms, Settings: enSettings },
  es: { Navigation: esNavigation, Pages: esPages, Map: esMap, Forms: esForms, Settings: esSettings },
}

export function loadMessages(locale: Locale): Messages { return catalogs[locale] }
