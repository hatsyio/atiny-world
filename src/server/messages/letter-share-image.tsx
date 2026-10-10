import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import satori from 'satori'
import type { Locale } from '@/i18n/locale'
import type { PublicMessageDetail } from '@/domain/messages/public-message'
import { letterExcerpt } from '@/domain/messages/letter-share'

export type ShareImageFormat = 'story' | 'square' | 'og'
export const shareImageSizes = { story: {width:1080, height:1920}, square: {width:1080, height:1080}, og: {width:1200, height:630} } as const
let fontsPromise: Promise<{name: string; data: Buffer; weight: 400; style: 'normal'}[]> | undefined
function loadFonts() {
  fontsPromise ??= Promise.all([
    ['Letter Serif', 'SourceSerif4-Regular.otf'],
    ['Letter Korean', 'NotoSansKR-Regular.otf'],
    ['Letter Emoji', 'NotoEmoji-Regular.ttf'],
  ].map(async ([name, file]) => ({name, data: await readFile(join(process.cwd(), 'src/assets/share-fonts', file)), weight: 400 as const, style:'normal' as const})))
  return fontsPromise
}
const fontFamily = 'Letter Serif, Letter Korean, Letter Emoji'

/** Measure with the same fonts and engine used by the final image, then fit at grapheme boundaries. */
export async function fitImageText(content: string, box: {width:number; height:number; fontSize:number}, locale: Locale) {
  const fonts = await loadFonts()
  const measure = async (text: string) => {
    let height = 0
    await satori(<div data-measure="letter" style={{display:'flex', width:box.width, fontFamily, fontSize:box.fontSize, lineHeight:1.45, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{text}</div>, {
      width:box.width, fonts,
      onNodeDetected: node => { if (node.props['data-measure'] === 'letter') height = node.height },
    })
    return height
  }
  const text = content.trim()
  const height = await measure(text)
  if (height <= box.height) return {text, height}
  let low = 2
  let high = [...new Intl.Segmenter(locale, {granularity:'grapheme'}).segment(text)].length
  let best = {text:'…', height: await measure('…')}
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = letterExcerpt(text, mid, locale)
    const measured = await measure(candidate)
    if (measured <= box.height) { best = {text:candidate, height:measured}; low = mid + 1 }
    else high = mid - 1
  }
  return best
}

export async function renderLetterShareImage(message: PublicMessageDetail, format: ShareImageFormat, locale: Locale): Promise<Response> {
  const size = shareImageSizes[format]
  const og = format === 'og'
  const story = format === 'story'
  const marginX = og ? 64 : 92
  const marginY = story ? 180 : og ? 36 : 68
  const innerWidth = size.width - marginX * 2
  const innerHeight = size.height - marginY * 2
  const padding = og ? 42 : 62
  const textWidth = innerWidth - padding * 2
  const fontSize = story ? 56 : og ? 34 : 42
  const bodyHeight = innerHeight - (og ? 220 : 380)
  const fitted = await fitImageText(message.content, {width:textWidth, height:bodyHeight, fontSize}, locale)
  const location = letterExcerpt([message.locality, message.country].filter(Boolean).join(', '), og ? 48 : 44, locale)
  const date = new Intl.DateTimeFormat(locale, {dateStyle:'long', timeZone:'UTC'}).format(new Date(message.publishedAt))
  const cta = locale === 'es' ? 'Continúa leyendo en Atiny Atlas' : 'Continue reading on Atiny Atlas'
  const svg = await satori(
    <div style={{display:'flex', width:size.width, height:size.height, backgroundColor:'#102033', padding:`${marginY}px ${marginX}px`, fontFamily, color:'#2b1a12'}}>
      <div style={{display:'flex', flexDirection:'column', width:innerWidth, height:innerHeight, backgroundColor:'#eed4a7', backgroundImage:'linear-gradient(125deg, #f6e4c3, #eed4a7 65%, #d9ac70)', border:'2px solid #c79a50', padding, boxShadow:'0 12px 32px #050e1b80'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:og ? 16 : 34, borderBottom:'1px solid #9f784f', fontSize:og ? 20 : 27}}>
          <div style={{display:'flex', maxWidth:textWidth - 64, wordBreak:'break-word'}}>{location}</div>
          <svg width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18" fill="none" stroke="#6a3b20" strokeWidth="1"/><path d="M21 3 L25 17 L39 21 L25 25 L21 39 L17 25 L3 21 L17 17 Z" fill="#6a3b20"/></svg>
        </div>
        <div style={{display:'flex', flex:1, alignItems:'center', paddingTop:og ? 12 : 28, paddingBottom:og ? 12 : 28}}>
          <div style={{display:'flex', width:textWidth, fontSize, lineHeight:1.45, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{fitted.text}</div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:og ? 6 : 12, fontSize:og ? 22 : 32}}>
          <div style={{display:'flex', wordBreak:'break-word'}}>{letterExcerpt(message.author.displayName, 40, locale)}</div>
          <div style={{display:'flex', fontSize:og ? 17 : 23, color:'#6a3b20'}}>{date}</div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8, borderTop:'1px solid #9f784f', marginTop:og ? 18 : 32, paddingTop:og ? 14 : 26, fontSize:og ? 18 : 25}}>
          <div style={{display:'flex'}}>{cta}</div>
          <div style={{display:'flex', fontSize:og ? 16 : 21, color:'#6a3b20'}}>atinyatlas.com</div>
        </div>
      </div>
    </div>, { ...size, fonts:await loadFonts() },
  )
  // Rasterize the measured SVG. All glyphs are embedded locally: no remote emoji/font fetches.
  // eslint-disable-next-line @next/next/no-img-element -- ImageResponse rasterizes intrinsic image elements, not next/image.
  return new ImageResponse(<div style={{display:'flex', ...size}}><img alt="" width={size.width} height={size.height} src={`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`} /></div>, {
    ...size, headers:{'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'},
  })
}
