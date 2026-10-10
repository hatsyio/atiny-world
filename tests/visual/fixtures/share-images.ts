import { renderLetterShareImage, type ShareImageFormat } from '@/server/messages/letter-share-image'
import type {Locale} from '@/i18n/locale'
import { shareLetter } from './share-letter'
export function renderFixtureShareImage(format:ShareImageFormat, locale:Locale) {
  return renderLetterShareImage(shareLetter, format, locale)
}
