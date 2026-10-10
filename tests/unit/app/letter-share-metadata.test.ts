import {beforeEach, expect, it, vi} from 'vitest'
vi.mock('@/components/messages/letter-detail', () => ({LetterDetail: () => null}))
vi.mock('next-intl/server', () => import('../../support/server-intl'))
vi.mock('@/server/db/client', () => ({getDb: () => ({})}))
vi.mock('@/server/messages/public-repository', () => ({getVisibleMessage:vi.fn()}))
vi.mock('@/server/auth/authorize', () => ({authorizeSession:vi.fn()}))
vi.mock('@/server/auth/session', () => ({getSessionIdentity:vi.fn(), readProfileByClerkUserId:vi.fn()}))
vi.mock('@/server/messages/own-message-repository', () => ({getOwnMessage:vi.fn()}))
import {generateMetadata} from '@/app/(site)/messages/[publicId]/page'
import {getVisibleMessage} from '@/server/messages/public-repository'
const id = 'a3a258ac-179d-40a6-ad22-d7ca4c59ac70'
beforeEach(() => vi.resetAllMocks())
it('prepares social metadata from public content only', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue({publicId:id, content:'A letter worth reading.', author:{displayName:'Josep'}} as never)
  const metadata = await generateMetadata({params:Promise.resolve({publicId:id})})
  expect(metadata.description).toBe('A letter worth reading.')
  expect(metadata.openGraph?.title).toContain('Josep')
  expect(metadata.openGraph?.images).toEqual([expect.objectContaining({width:1200, height:630, url:expect.stringContaining(`/api/messages/${id}/social-image?locale=en`)})])
  expect(metadata.twitter).toMatchObject({card:'summary_large_image'})
})
it('never puts private or withdrawn letter text in metadata', async () => {
  vi.mocked(getVisibleMessage).mockResolvedValue(null)
  const metadata = await generateMetadata({params:Promise.resolve({publicId:id})})
  expect(metadata.openGraph).toBeUndefined()
  expect(metadata.twitter).toBeUndefined()
  expect(metadata.description).toBeUndefined()
})
