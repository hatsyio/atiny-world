import { expect, it } from 'vitest'
import { renderLetterShareImage, fitImageText } from '@/server/messages/letter-share-image'

const letter = {
  publicId: 'a3a258ac-179d-40a6-ad22-d7ca4c59ac70', content: 'Una carta para quienes sienten la música. Seguimos navegando juntos.',
  locality: 'Barcelona', country: 'España', countryCode: 'es', point: {latitude: 0, longitude: 0}, precision: 'approximate' as const,
  author: {publicId: 'author', displayName: 'Josep'}, publishedAt: '2026-10-11T12:00:00Z',
}
it.each([['story', 1080, 1920], ['square', 1080, 1080], ['og', 1200, 630]] as const)('renders a real %s PNG with the specified dimensions and no persistent cache', async (format, width, height) => {
  const response = await renderLetterShareImage(letter, format, 'es')
  const png = Buffer.from(await response.arrayBuffer())
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect(png.readUInt32BE(16)).toBe(width)
  expect(png.readUInt32BE(20)).toBe(height)
  expect(response.headers.get('Cache-Control')).toContain('no-store')
}, 30000)
it('fits long Korean and joined emoji text without splitting graphemes or overflowing', async () => {
  const fitted = await fitImageText('사랑해요 👨‍👩‍👧‍👦 ATINY. '.repeat(200), {width: 900, height: 400, fontSize: 46}, 'es')
  expect(fitted.text).toMatch(/…$/)
  expect(fitted.height).toBeLessThanOrEqual(400)
  expect(fitted.text).not.toMatch(/\u200d…$/)
}, 30000)
it('preserves the full letter when it fits', async () => {
  const fitted = await fitImageText(letter.content, {width: 900, height: 900, fontSize: 46}, 'es')
  expect(fitted.text).toBe(letter.content)
})
