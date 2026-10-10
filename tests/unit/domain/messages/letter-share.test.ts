import { describe, expect, it } from 'vitest'
import { letterExcerpt, prepareLetterShare, xTextWeight } from '@/domain/messages/letter-share'

const message = {
  publicId: 'a3a258ac-179d-40a6-ad22-d7ca4c59ac70', content: 'Una carta para quienes sienten la música. Seguimos navegando juntos.',
  locality: 'Barcelona', country: 'España', author: { publicId: 'author', displayName: 'Josep' },
}

describe('sharing letter text', () => {
  it('uses a canonical letter URL and literal introduction in the active language', () => {
    const share = prepareLetterShare(message, 'es', 'https://atinyatlas.com/path?returnTo=private')
    expect(share.url).toBe(`https://atinyatlas.com/messages/${message.publicId}`)
    expect(share.text).toContain(message.content)
    expect(share.text).toContain('Una carta desde Barcelona, España.')
    expect(share.text).toContain('Lee mi carta completa en Atiny Atlas:')
  })
  it('ends excerpts at sentence boundaries and marks omitted content', () => {
    expect(letterExcerpt('Primera frase. Segunda frase muy larga.', 22, 'es')).toBe('Primera frase.…')
    expect(letterExcerpt('Texto corto.', 30, 'es')).toBe('Texto corto.')
    expect(letterExcerpt('Hola mundo largo', 12, 'es')).toBe('Hola mundo…')
  })
  it('never splits a joined emoji, accent or Korean grapheme', () => {
    const text = '👨‍👩‍👧‍👦 é 사랑해요'
    expect(letterExcerpt(text, 2, 'es')).toBe('👨‍👩‍👧‍👦…')
    expect(letterExcerpt('사랑해요사랑해요', 5, 'en')).toBe('사랑해요…')
  })
  it('encodes destinations without duplicating the URL', () => {
    const share = prepareLetterShare({...message, content: '¿A&B? #ATINY 사랑해요'}, 'en', 'https://atinyatlas.com')
    for (const destination of ['x', 'threads', 'telegram'] as const) {
      const url = new URL(share.destinations[destination])
      expect(url.searchParams.get('url')).toBe(share.url)
      expect(url.searchParams.get('text')).toContain('¿A&B? #ATINY 사랑해요')
      expect(url.searchParams.get('text')).not.toContain(share.url)
    }
    expect(new URL(share.destinations.whatsapp).searchParams.get('text')).toBe(share.text)
  })
  it('fits long locations, CJK and emoji within the X and Threads budgets', () => {
    const share = prepareLetterShare({...message, locality: 'Barcelona '.repeat(50), country: 'España '.repeat(50), content: '사랑해요 👨‍👩‍👧‍👦 ATINY. '.repeat(300)}, 'es', 'https://atinyatlas.com')
    const xText = new URL(share.destinations.x).searchParams.get('text')!
    expect(xTextWeight(xText) + 24).toBeLessThanOrEqual(280)
    const threadsText = new URL(share.destinations.threads).searchParams.get('text')!
    expect(Array.from(threadsText + '\n' + share.url).length).toBeLessThanOrEqual(500)
    expect(xText).toContain('Lee mi carta completa')
  })
})

it('counts short links in the letter using X’s fixed URL weight', () => {
  expect(xTextWeight('https://a.co')).toBe(23)
  const share = prepareLetterShare({...message, content:'https://a.co '.repeat(25)}, 'en', 'https://atinyatlas.com')
  const text = new URL(share.destinations.x).searchParams.get('text')!
  const normalized = text.replace(/https:\/\/a\.co/g, 'x'.repeat(23))
  expect(Array.from(normalized).length + 24).toBeLessThanOrEqual(280)
})
