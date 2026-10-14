import { getDb } from '@/server/db/client'
import { getVisibleMessage } from '@/server/messages/public-repository'
import { parseShareImageRequest, shareImageError } from '@/server/messages/letter-share-access'
import { renderLetterShareImage } from '@/server/messages/letter-share-image'

export const dynamic = 'force-dynamic'
export async function GET(request: Request, {params}: {params:Promise<{publicId:string}>}) {
  const input = parseShareImageRequest(request, (await params).publicId, true)
  if (!input) return shareImageError(400)
  const message = await getVisibleMessage(getDb(), input.publicId)
  if (!message) return shareImageError(404)
  return renderLetterShareImage(message, 'og', input.locale)
}
