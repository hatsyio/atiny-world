import { expect, it } from 'vitest'
import { returnDestination } from '@/components/navigation/return-destination'

it.each([
  ['/es#map', '/es#map', 'Volver al mapa'],
  ['/es', '/es', 'Volver al inicio'],
  ['/en#letters', '/es#letters', 'Volver a las cartas'],
  ['/es#about', '/es#about', 'Volver al proyecto'],
  ['/es/my-messages?cursor=older', '/es/my-messages?cursor=older', 'Volver a mis cartas'],
  ['/es/messages/letter-id', '/es/messages/letter-id', 'Volver a la carta'],
] as const)('names and localizes a known destination: %s', (origin, href, back) => {
  expect(returnDestination('es', origin)).toMatchObject({ href, back })
})

it.each([
  undefined, [], ['/es'], '', '//evil.example', 'https://evil.example',
  'javascript:alert(1)', '/es/\\evil.example', '/es/messages/new',
  '/es/my-messages/id/edit', '/es/sign-in', '/es#unknown', '/fr#map',
])('uses the map for an absent or unsupported origin: %s', origin => {
  expect(returnDestination('es', origin)).toEqual({
    href: '/es#map', back: 'Volver al mapa', cancel: 'Cancelar y volver al mapa',
  })
})
