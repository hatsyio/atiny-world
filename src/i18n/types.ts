import type navigation from './messages/en/navigation.json'
import type pages from './messages/en/pages.json'
import type map from './messages/en/map.json'
import type forms from './messages/en/forms.json'
import type settings from './messages/en/settings.json'
import type { Locale } from './locale'

export type Messages = { Navigation: typeof navigation; Pages: typeof pages; Map: typeof map; Forms: typeof forms; Settings: typeof settings }
declare module 'next-intl' {
  interface AppConfig { Locale: Locale; Messages: Messages }
}
