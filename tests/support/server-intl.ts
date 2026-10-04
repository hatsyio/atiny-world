import {createTranslator} from 'next-intl'
import enPages from '@/i18n/messages/en/pages.json'
import esPages from '@/i18n/messages/es/pages.json'
import enNavigation from '@/i18n/messages/en/navigation.json'
import esNavigation from '@/i18n/messages/es/navigation.json'

let locale: 'en' | 'es' = 'en'
export function setServerLocale(value: string): 'en' | 'es' { locale = value === 'es' ? 'es' : 'en'; return locale }
export async function getLocale() { return locale }
export async function getTranslations(namespace: 'Navigation' | 'Pages' | 'Pages.home' | 'Pages.newLetter' | 'Pages.profile' | 'Pages.ownLetters' | 'Pages.editLetter' | 'Pages.publicLetter' | 'Pages.settings') {
  return createTranslator({locale, messages: locale === 'es' ? {Pages: esPages, Navigation: esNavigation} : {Pages: enPages, Navigation: enNavigation}, namespace})
}
