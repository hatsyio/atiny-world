import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/server/db/client', () => ({getDb: () => ({})}))
vi.mock('@/server/auth/authorize', () => ({authorizeSession: vi.fn()}))
vi.mock('@/server/auth/session', () => ({getSessionIdentity: vi.fn()}))
vi.mock('@/server/messages/own-message-repository', () => ({getOwnMessage: vi.fn()}))
vi.mock('@/server/messages/public-repository', () => ({getVisibleMessage: vi.fn()}))
vi.mock('@/server/messages/letter-share-image', () => ({renderLetterShareImage: vi.fn(() => new Response('png', {headers: {'Cache-Control': 'no-store'}}))}))
import {authorizeSession} from '@/server/auth/authorize'
import {getSessionIdentity} from '@/server/auth/session'
import {getOwnMessage} from '@/server/messages/own-message-repository'
import {getVisibleMessage} from '@/server/messages/public-repository'
import {GET as exportImage} from '@/app/api/messages/[publicId]/share-image/route'
import {GET as publicImage} from '@/app/api/messages/[publicId]/social-image/route'
const id = 'a3a258ac-179d-40a6-ad22-d7ca4c59ac70'
const params = {params: Promise.resolve({publicId: id})}
const request = (query = '') => new Request(`https://atinyatlas.com/api/messages/${id}/share-image${query}`)
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authorizeSession).mockResolvedValue({ok: true, data: {profileId:'profile', publicId: 'author', displayName:'Josep', role:'fan'}})
  vi.mocked(getSessionIdentity).mockResolvedValue({clerkUserId: 'owner'})
  vi.mocked(getOwnMessage).mockResolvedValue({publicId: id} as never)
  vi.mocked(getVisibleMessage).mockResolvedValue({publicId: id, author:{publicId:'author', displayName:'Josep'}} as never)
})
it('exports a public letter to its authorized owner', async () => {
  expect((await exportImage(request('?format=story&locale=es'), params)).status).toBe(200)
})
it.each(['ACCOUNT_SUSPENDED', 'ACCOUNT_DELETION_PENDING', 'NOT_FOUND'] as const)('denies private export for %s', async code => {
  vi.mocked(authorizeSession).mockResolvedValue({ok:false, error:{code}})
  const response = await exportImage(request(), params)
  expect(response.status).toBe(403)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
it('denies export of someone else’s letter', async () => {
  vi.mocked(getOwnMessage).mockResolvedValue(null)
  expect((await exportImage(request(), params)).status).toBe(404)
})
it('denies export after a letter is withdrawn', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  expect((await exportImage(request(), params)).status).toBe(404)
})
it.each(['?format=og', '?format=html', '?locale=fr', '?format=story&format=square', '?url=https://example.com'])('rejects invalid export parameters %s', async query => {
  expect((await exportImage(request(query), params)).status).toBe(400)
})
it('rejects an invalid identifier', async () => {
  expect((await exportImage(request(), {params:Promise.resolve({publicId:'invalid'})})).status).toBe(400)
})
it('never reads the private letter for a public social image', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  const response = await publicImage(request('?locale=es'), params)
  expect(response.status).toBe(404)
  expect(getOwnMessage).not.toHaveBeenCalled()
})
it('allows visitors to retrieve a public social image', async () => {
  expect((await publicImage(request('?locale=en'), params)).status).toBe(200)
  expect(authorizeSession).not.toHaveBeenCalled()
})
