import { expect, it } from 'vitest'
import { returnDestination } from '@/components/navigation/return-destination'

it.each([
  ['/#map', '/#map', 'Volver al mapa'],
  ['/', '/', 'Volver al inicio'],
  ['/#letters', '/#letters', 'Volver a las cartas'],
  ['/about', '/about', 'Volver al proyecto'],
  ['/#about', '/#about', 'Volver al proyecto'],
  ['/my-messages?cursor=older', '/my-messages?cursor=older', 'Volver a mis cartas'],
  ['/messages/letter-id', '/messages/letter-id', 'Volver a la carta'],
] as const)('names and localizes a known destination: %s', (origin, href, back) => {
  expect(returnDestination('es', origin)).toMatchObject({ href, back })
})

it.each([
  undefined, [], [''], '', '//evil.example', 'https://evil.example',
  'javascript:alert(1)', '/\\evil.example', '/messages/new',
  '/my-messages/id/edit', '/sign-in', '/#unknown', '/fr#map',
])('uses the map for an absent or unsupported origin: %s', origin => {
  expect(returnDestination('es', origin)).toEqual({
    href: '/#map', back: 'Volver al mapa', cancel: 'Cancelar y volver al mapa',
  })
})
