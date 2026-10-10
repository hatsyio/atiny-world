import { parsePublicId } from '@/domain/contracts'
import type { Locale } from '@/i18n/locale'
import type { ShareImageFormat } from './letter-share-image'

export const shareImageHeaders = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}
export function shareImageError(status: number) {
  return new Response(null, {status, headers:shareImageHeaders})
}
export function parseShareImageRequest(request: Request, publicId: string, publicImage = false): {publicId:string; locale:Locale; format:ShareImageFormat} | null {
  const id = parsePublicId(publicId)
  if (!id.ok) return null
  const params = new URL(request.url).searchParams
  const allowed = publicImage ? ['locale'] : ['locale', 'format']
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) return null
  const locale = params.get('locale') ?? 'en'
  const format = publicImage ? 'og' : params.get('format') ?? 'square'
  if (locale !== 'es' && locale !== 'en') return null
  if (format !== 'story' && format !== 'square' && !(publicImage && format === 'og')) return null
  return {publicId:id.value, locale, format:format as ShareImageFormat}
}
