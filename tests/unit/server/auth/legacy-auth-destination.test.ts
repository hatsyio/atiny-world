import {expect, it} from 'vitest'
import {authDestination, authRoute} from '@/server/auth/auth-destination'

it.each(['en', 'es'] as const)('normalizes historical routes independently of reader locale %s', reader => {
  expect(authDestination(reader, '/es/my-messages?cursor=older%2Bpage')).toBe('/my-messages?cursor=older%2Bpage')
  expect(authRoute(reader, 'sign-in', '/en/messages/new?returnTo=%2Fes%2Fmy-messages%3Fcursor%3Dolder')).toBe('/sign-in?next=%2Fmessages%2Fnew%3FreturnTo%3D%252Fmy-messages%253Fcursor%253Dolder')
})

it.each(['en', 'es'] as const)('preserves settings across authentication without allowing auth loops in %s', locale => {
  expect(authDestination(locale, '/settings')).toBe('/settings')
  expect(authDestination(locale, '/es/settings')).toBe('/settings')
  expect(authRoute(locale, 'auth/continue', '/settings')).toBe('/auth/continue?next=%2Fsettings')
  expect(authDestination(locale, '/sign-in')).toBe('/')
  expect(authDestination(locale, '/auth/continue')).toBe('/')
})
