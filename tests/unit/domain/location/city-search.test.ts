import { describe, expect, it } from 'vitest'
import { matchesCity, normalizeCitySearch } from '@/domain/location/city-search'

describe('city search', () => {
  it.each([
    ['Madrid', ' MÁ-D ', true],
    ['Madrid', 'Mad༳', true],
    ['São Paulo', 'sao-pa', true],
    ['Torrejón', 'TORREJO\u0301', true],
    ['München', 'mun', true],
    ['Ｐaris', 'par', true],
    ['東京', '東', true],
    ['서울', '서', true],
    ['Madrid', 'Barcelona', false],
    ['Madrid', '%_', false],
    [null, 'Mad', false],
    [null, '', true],
  ])('matches %s against %s: %s', (city, query, expected) => {
    expect(matchesCity(city, query)).toBe(expected)
  })

  it('normalizes accents, case, punctuation and spacing', () => {
    expect(normalizeCitySearch(' São-ＰAULO! ')).toBe('saopaulo')
  })
})
