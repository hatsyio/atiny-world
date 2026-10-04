import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, insertMessage, insertProfile, truncateProductTables } from '../support/database'
import { getVisibleMessage } from '../../src/server/messages/public-repository'
import { saveLanguagePreferenceForSession } from '../../src/server/auth/language-preference'

const db = createTestDb()
beforeEach(() => truncateProductTables(db))
afterAll(async () => { await truncateProductTables(db); await db.end() })

describe('international letters and reader preferences', () => {
  it('keeps UTF-8 Korean, composed emojis and newlines identical while changing preference', async () => {
    const content = '에이티즈 사랑해요 👩🏽‍🚀👨‍👩‍👧‍👦\n항상 응원합니다 🏳️‍🌈\n\n같은 하늘 아래'
    const author = await insertProfile(db, 'international-author')
    const reader = await insertProfile(db, 'international-reader')
    const message = await insertMessage(db, author.id, { content, status: 'approved', published_at: '2026-10-04T23:59:00Z' })
    const before = await getVisibleMessage(db, message.public_id)
    expect(before?.content).toBe(content)
    for (const preference of ['es', 'en', 'auto'] as const) {
      expect(await saveLanguagePreferenceForSession(db, preference, async () => ({ clerkUserId: reader.clerk_user_id }))).toBe(true)
      const after = await getVisibleMessage(db, message.public_id)
      expect(after).toEqual(before)
      expect(Buffer.from(after!.content, 'utf8')).toEqual(Buffer.from(content, 'utf8'))
    }
    const [row] = await db<{ content: string; version: number }[]>`select content, version from app_private.messages where public_id = ${message.public_id}`
    expect(row).toEqual({ content, version: 1 })
  })
})
