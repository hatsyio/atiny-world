import { authorizeSession } from '@/server/auth/authorize'
import { getSessionIdentity } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { getOwnMessage } from '@/server/messages/own-message-repository'
import { getVisibleMessage } from '@/server/messages/public-repository'
import { parseShareImageRequest, shareImageError } from '@/server/messages/letter-share-access'
import { renderLetterShareImage } from '@/server/messages/letter-share-image'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, {params}: {params:Promise<{publicId:string}>}) {
  const input = parseShareImageRequest(request, (await params).publicId)
  if (!input) return shareImageError(400)
  const db = getDb()
  const authorization = await authorizeSession(db)
  if (!authorization.ok) return shareImageError(403)
  const identity = await getSessionIdentity()
  if (!identity) return shareImageError(403)
  const own = await getOwnMessage(db, {clerkUserId:identity.clerkUserId, publicId:input.publicId})
  if (!own) return shareImageError(404)
  const message = await getVisibleMessage(db, input.publicId)
  if (!message || message.author.publicId !== authorization.data.publicId) return shareImageError(404)
  return renderLetterShareImage(message, input.format, input.locale)
}
