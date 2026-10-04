import {createTranslator} from 'next-intl'
import type {Locale} from './locale'
import en from './messages/en/navigation.json'
import es from './messages/es/navigation.json'

const messages = {en, es}
export function navigationTranslator(locale: Locale) {
  return createTranslator({locale, messages: messages[locale]})
}
