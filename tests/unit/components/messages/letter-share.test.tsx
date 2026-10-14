/** @vitest-environment jsdom */
import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {render} from '../../../support/intl'
import {LetterShare} from '@/components/messages/letter-share'
const message = {
  publicId:'a3a258ac-179d-40a6-ad22-d7ca4c59ac70', content:'My original letter. Read on.', locality:'Barcelona', country:'España', countryCode:'es',
  point:{latitude:0, longitude:0}, precision:'approximate' as const, author:{publicId:'author', displayName:'Josep'}, publishedAt:'2026-10-11T12:00:00Z',
}
const clipboard = vi.fn()
beforeEach(() => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['png'], {type:'image/png'}))))
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:clipboard.mockResolvedValue(undefined)}})
  Object.defineProperty(navigator, 'userAgentData', {configurable:true, value:undefined})
  Object.defineProperty(navigator, 'share', {configurable:true, value:undefined})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:undefined})
  vi.stubGlobal('URL', Object.assign(URL, {createObjectURL:vi.fn(() => 'blob:test-letter'), revokeObjectURL:vi.fn()}))
})
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); clipboard.mockReset()})
async function open() {
  render(<LetterShare message={message} origin="https://atinyatlas.com" />)
  fireEvent.click(screen.getByRole('button', {name:'Share'}))
  await screen.findByRole('dialog', {name:'Share your letter'})
}
it('opens the menu without LinkedIn or an application share link', async () => {
  await open()
  expect(screen.getByRole('link', {name:'Threads'})).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', {name:'X / Twitter'})).toHaveAttribute('href', expect.stringContaining('intent/tweet'))
  expect(screen.queryByRole('button', {name:'More options'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'Copy letter link'}))
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(`https://atinyatlas.com/messages/${message.publicId}`))
  expect(await screen.findByRole('status')).toHaveTextContent('Link copied')
  expect(screen.queryByRole('button', {name:'Copy Atiny Atlas link'})).toBeNull()
  expect(screen.queryByRole('link', {name:'LinkedIn'})).toBeNull()
})
it('offers selectable text when clipboard permission is denied', async () => {
  clipboard.mockRejectedValue(new Error('denied'))
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Copy letter link'}))
  expect(await screen.findByRole('textbox', {name:'Copy manually'})).toHaveValue(`https://atinyatlas.com/messages/${message.publicId}`)
})
it('loads an image preview, changes format and provides a downloadable PNG', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Instagram story'}))
  expect(await screen.findByRole('dialog', {name:'Your letter, ready to travel'})).toBeVisible()
  const download = await screen.findByRole('link', {name:'Download image'})
  expect(download).toHaveAttribute('download', expect.stringContaining('story.png'))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('format=story&locale=en'), expect.anything())
  fireEvent.click(screen.getByRole('button', {name:'Post · 1:1'}))
  await waitFor(() => expect(screen.getByRole('link', {name:'Download image'})).toHaveAttribute('download', expect.stringContaining('square.png')))
  expect(URL.revokeObjectURL).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name:'Close'}))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(screen.getByRole('button', {name:'Share'})).toHaveFocus())
})
it('keeps copy actions available after a failed image request and retries', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, {status:404}))
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Instagram story'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the image')
  fireEvent.click(screen.getByRole('button', {name:'Copy text'}))
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(expect.stringContaining(message.content)))
  fireEvent.click(screen.getByRole('button', {name:'Try again'}))
  expect(await screen.findByRole('link', {name:'Download image'})).toBeVisible()
})
it('treats cancellation of native sharing as a normal dismissal', async () => {
  Object.defineProperty(navigator, 'share', {configurable:true, value:vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError'))})
  await open()
  fireEvent.click(screen.getByRole('button', {name:'More options'}))
  await waitFor(() => expect(navigator.share).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shares an already prepared PNG file and preserves download when the system rejects sharing', async () => {
  const native = vi.fn().mockRejectedValue(new Error('blocked'))
  Object.defineProperty(navigator, 'share', {configurable:true, value:native})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Instagram story'}))
  const button = await screen.findByRole('button', {name:'Share image'})
  fireEvent.click(button)
  await waitFor(() => expect(native).toHaveBeenCalledWith({files:[expect.objectContaining({name:expect.stringContaining('story.png'), type:'image/png'})]}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not share')
  expect(screen.getByRole('link', {name:'Download image'})).toBeVisible()
})


it('opens the Instagram post action with a square image', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Instagram post'}))
  expect(await screen.findByRole('link', {name:'Download image'})).toHaveAttribute('download', expect.stringContaining('square.png'))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('format=square&locale=en'), expect.anything())
})

it.each([['Instagram story','story'], ['Instagram post','square']] as const)('hands %s directly to the native menu with its prepared image', async (label, format) => {
  const native = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', {configurable:true, value:native})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  await open()
  const action = screen.getByRole('button', {name:label})
  await waitFor(() => expect(action).toBeEnabled())
  fireEvent.click(action)
  await waitFor(() => expect(native).toHaveBeenCalledWith(expect.objectContaining({files:[expect.objectContaining({name:expect.stringContaining(`${format}.png`)})]})))
  expect(native.mock.calls[0][0].text).toBeUndefined()
})

it('falls back to text links and explains a failed native image preparation', async () => {
  Object.defineProperty(navigator, 'share', {configurable:true, value:vi.fn()})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  vi.mocked(fetch).mockResolvedValue(new Response(null, {status:503}))
  await open()
  expect(await screen.findByText('Some images could not be prepared. Share the link or retry from the image preview.')).toBeVisible()
  expect(screen.getByRole('link', {name:'X / Twitter'})).toHaveAttribute('href', expect.stringContaining('intent/tweet'))
  expect(screen.getByRole('button', {name:'Instagram story'})).toBeEnabled()
})


it.each(['Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'])('keeps desktop composers even when native file sharing exists: %s', async userAgent => {
  vi.mocked(Object.getOwnPropertyDescriptor(navigator, 'userAgent')!.get!).mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'share', {configurable:true, value:vi.fn()})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  await open()
  expect(screen.getByRole('link', {name:'X / Twitter'})).toHaveAttribute('href', expect.stringContaining('intent/tweet'))
  expect(screen.getByRole('link', {name:'Threads'})).toHaveAttribute('href', expect.stringContaining('intent/post'))
  for (const name of ['Instagram story', 'Instagram post']) {
    expect(screen.getByRole('button', {name})).toBeEnabled()
    expect(screen.queryByRole('link', {name})).toBeNull()
  }
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  ['Android phone', 'Mozilla/5.0 (Linux; Android 14; Mobile)', true],
  ['Android tablet', 'Mozilla/5.0 (Linux; Android 14; Tablet)', false],
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true],
] as const)('opens targeted X and Threads composers on %s instead of the system share sheet', async (_device, userAgent, mobile) => {
  vi.mocked(Object.getOwnPropertyDescriptor(navigator, 'userAgent')!.get!).mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'userAgentData', {configurable:true, value:{mobile, platform:_device === 'iPhone' ? 'iOS' : 'Android'}})
  Object.defineProperty(navigator, 'share', {configurable:true, value:vi.fn().mockResolvedValue(undefined)})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  await open()
  for (const [name, path] of [['X / Twitter','intent/tweet'], ['Threads','intent/post']] as const) {
    const link = screen.getByRole('link', {name})
    expect(link).toHaveAttribute('href', expect.stringContaining(path))
    expect(link).toHaveAttribute('target', '_blank')
    const url = new URL(link.getAttribute('href')!)
    expect(url.searchParams.get('text')).toContain('Read my full letter')
    expect(url.searchParams.get('url')).toContain(message.publicId)
  }
  expect(navigator.share).not.toHaveBeenCalled()
})

it.each([['Instagram story','story'], ['Instagram post','square']] as const)('keeps desktop %s on the image download screen without an Instagram link', async (label, format) => {
  vi.mocked(Object.getOwnPropertyDescriptor(navigator, 'userAgent')!.get!).mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')
  Object.defineProperty(navigator, 'share', {configurable:true, value:vi.fn()})
  Object.defineProperty(navigator, 'canShare', {configurable:true, value:() => true})
  await open()
  fireEvent.click(screen.getByRole('button', {name:label}))
  expect(await screen.findByRole('link', {name:'Download image'})).toHaveAttribute('download', expect.stringContaining(`${format}.png`))
  expect(screen.queryByRole('link', {name:'Open Instagram'})).toBeNull()
  expect(screen.queryByRole('button', {name:'Share image'})).toBeNull()
})
