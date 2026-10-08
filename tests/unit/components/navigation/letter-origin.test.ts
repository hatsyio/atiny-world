import { describe, expect, it } from 'vitest'
import { letterDestination, mapOrigin, readMapView } from '@/components/navigation/letter-origin'

describe('letter reading origins', () => {
  it.each([
    ['/es#letters-letter-1', '/#letters-letter-1', 'Volver a las cartas'],
    ['/es/my-messages?cursor=older%2Bpage#own-letter-1', '/my-messages?cursor=older%2Bpage#own-letter-1', 'Volver a mis cartas'],
    ['/es?mapView=40.4%2C-3.7%2C8&mapCity=Madrid&mapCountry=es#map', '/?mapView=40.4%2C-3.7%2C8&mapCity=Madrid&mapCountry=es#map', 'Volver al mapa'],
  ])('retains the reading destination %s', (input, href, back) => {
    expect(letterDestination('es', input)).toEqual({ href, back })
  })

  it.each([undefined, [' /es#map'], 'https://evil.example', '//evil.example/es#map', '/es/../en#map', '/es/messages/new', '/es/sign-in', '/es?returnTo=https://evil.example#map', '/es#unknown', '/es\\#map'])('falls back safely for %s', input => {
    expect(letterDestination('es', input)).toEqual({ href: '/#map', back: 'Volver al mapa' })
  })

  it('translates the own-letter destination in English', () => {
    expect(letterDestination('en', '/en/my-messages?cursor=abc#own-letter-1').back).toBe('Back to my letters')
  })

  it('round trips a map across the date line with zoom and filters', () => {
    const href = mapOrigin({ latitude: 12, longitude: 185, zoom: 5 }, { city: 'Seoul & Busan', country: 'kr' })
    expect(href).toBe('/?mapView=12%2C-175%2C5&mapCity=Seoul+%26+Busan&mapCountry=kr#map')
    expect(readMapView(new URL(href, 'https://local.test').searchParams)).toEqual({ latitude: 12, longitude: -175, zoom: 5 })
  })

  it.each(['', 'NaN,0,2', '90,0,2', '20,181,2', '20,0,99', '20,0', ',,'])('ignores an invalid viewport %s', mapView => {
    expect(readMapView(new URLSearchParams({ mapView }))).toBeUndefined()
  })
})
