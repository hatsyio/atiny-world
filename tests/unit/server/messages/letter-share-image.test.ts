import { expect, it } from 'vitest'
import satori from 'satori'
import { renderLetterShareImage, fitImageText, prepareLetterShareImage } from '@/server/messages/letter-share-image'

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


it.each(['story', 'square', 'og'] as const)('keeps every text block inside the %s paper for long content, location and signature', async format => {
  const long = {...letter, content:'Wandering through the world with music in my heart and friends by my side. '.repeat(50), locality:'부산광역시'.repeat(10), country:'대한민국', author:{...letter.author, displayName:'김'.repeat(40)}}
  const {element, size, fonts} = await prepareLetterShareImage(long, format, 'en')
  const nodes: {id:string; left:number; top:number; width:number; height:number}[] = []
  await satori(element, {...size, fonts, onNodeDetected: node => {if (typeof node.props.id === 'string') nodes.push({id:node.props.id, left:node.left, top:node.top, width:node.width, height:node.height})}})
  const paper = nodes.find(node => node.id === 'letter-paper')!
  for (const node of nodes.filter(node => node.id !== 'letter-paper')) {
    expect(node.left, node.id).toBeGreaterThanOrEqual(paper.left)
    expect(node.left + node.width, node.id).toBeLessThanOrEqual(paper.left + paper.width)
    expect(node.top, node.id).toBeGreaterThanOrEqual(paper.top)
    expect(node.top + node.height, node.id).toBeLessThanOrEqual(paper.top + paper.height)
  }
  const body = nodes.find(node => node.id === 'letter-body')!
  const footer = nodes.find(node => node.id === 'letter-footer')!
  expect(body.top + body.height).toBeLessThanOrEqual(footer.top)
  expect(nodes.some(node => node.id === 'letter-domain')).toBe(true)
}, 30000)
