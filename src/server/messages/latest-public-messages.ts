import 'server-only'

import { unstable_cache } from 'next/cache'
import type { Sql } from '@/server/db/sql'

import type { PublicMessageDetail, PublicPoint } from '@/domain/messages/public-message'
import { reverseGeoapifyLocality } from '@/server/locations/geoapify'
import {
  listLatestPublicMessages,
} from '@/server/messages/public-repository'

type LocalityResolver = (point: PublicPoint) => Promise<string | null>

const resolveCachedLocality = unstable_cache(
  reverseGeoapifyLocality,
  ['legacy-public-message-locality'],
  { revalidate: 60 * 60 * 24 * 30 },
)

export async function enrichMissingLocalities(
  messages: PublicMessageDetail[],
  resolveLocality: LocalityResolver,
): Promise<PublicMessageDetail[]> {
  return Promise.all(messages.map(async (message) => {
    if (message.locality !== null) return message

    try {
      const locality = await resolveLocality(message.point)
      return locality ? { ...message, locality } : message
    } catch {
      return message
    }
  }))
}

export async function listLatestHomepageMessages(sql: Sql): Promise<PublicMessageDetail[]> {
  const messages = await listLatestPublicMessages(sql)
  return enrichMissingLocalities(messages, resolveCachedLocality)
}
