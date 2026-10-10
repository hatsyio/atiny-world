import type { Locale } from '@/i18n/locale'
import type { PublicMessageDetail } from './public-message'

export type ShareLetter = Pick<PublicMessageDetail, 'publicId' | 'content' | 'locality' | 'country' | 'author'>
export type SocialDestination = 'threads' | 'x' | 'whatsapp' | 'telegram' | 'facebook' | 'linkedin' | 'pinterest'

export function letterExcerpt(content: string, max: number, locale: Locale): string {
  const text = content.trim()
  const graphemes = [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)]
  if (graphemes.length <= max) return text
  if (max < 2) return '…'
  const prefix = graphemes.slice(0, max - 1).map(item => item.segment).join('')
  const sentences = [...new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text)]
  const complete = sentences.filter(item => item.index + item.segment.trimEnd().length <= prefix.length)
  const last = complete.at(-1)
  if (last) return text.slice(0, last.index + last.segment.trimEnd().length) + '…'
  const words = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(prefix)]
  const lastWord = words.filter(item => item.isWordLike && item.index + item.segment.length < prefix.length).at(-1)
  // A first word longer than the budget still has to produce a useful excerpt.
  return (lastWord ? prefix.slice(0, lastWord.index + lastWord.segment.length) : prefix).trimEnd() + '…'
}

/** Conservatively counts joined emoji separately; overcounts rather than exceeding X's limit. */
export function xTextWeight(text: string): number {
  return Array.from(text).reduce((sum, char) => {
    const point = char.codePointAt(0)!
    const single = point <= 0x10ff || (point >= 0x2000 && point <= 0x200d) ||
      (point >= 0x2010 && point <= 0x201f) || (point >= 0x2032 && point <= 0x2037)
    return sum + (single ? 1 : 2)
  }, 0)
}

function intent(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  url.search = new URLSearchParams(params).toString()
  return url.toString()
}

export function prepareLetterShare(message: ShareLetter, locale: Locale, origin: string) {
  const base = new URL(new URL(origin).origin)
  const url = new URL(`/messages/${encodeURIComponent(message.publicId)}`, base).toString()
  const location = letterExcerpt([message.locality, message.country].filter(Boolean).join(', '), 48, locale)
  const intro = locale === 'es' ? `Una carta desde ${location}.` : `A letter from ${location}.`
  const cta = locale === 'es' ? 'Lee mi carta completa en Atiny Atlas:' : 'Read my full letter on Atiny Atlas:'
  function caption(budget: number, weight: (text: string) => number): string {
    const shell = `${intro}\n\n«»\n\n${cta}`
    let size = Math.max(2, budget - weight(shell))
    let excerpt = letterExcerpt(message.content, size, locale)
    while (weight(excerpt) > budget - weight(shell) && size > 2) {
      excerpt = letterExcerpt(message.content, --size, locale)
    }
    return `${intro}\n\n«${excerpt}»\n\n${cta}`
  }
  // One newline + the standard 23-character t.co URL occupy 24 weighted characters.
  const x = caption(256, xTextWeight)
  const full = caption(Math.max(120, 499 - Array.from(url).length), text => Array.from(text).length)
  return {
    url,
    text: `${full}\n${url}`,
    destinations: {
      threads: intent('https://www.threads.com/intent/post', { text: full, url }),
      x: intent('https://twitter.com/intent/tweet', { text: x, url }),
      whatsapp: intent('https://wa.me/', { text: `${full}\n${url}` }),
      telegram: intent('https://t.me/share/url', { text: full, url }),
      facebook: intent('https://www.facebook.com/sharer/sharer.php', { u: url }),
      linkedin: intent('https://www.linkedin.com/sharing/share-offsite/', { url }),
      pinterest: intent('https://www.pinterest.com/pin/create/button/', {
        url, description: full, media: new URL(`/api/messages/${encodeURIComponent(message.publicId)}/social-image?locale=${locale}`, base).toString(),
      }),
    } satisfies Record<SocialDestination, string>,
  }
}
