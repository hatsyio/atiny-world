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
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['png'], {type:'image/png'}))))
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:clipboard.mockResolvedValue(undefined)}})
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
it('opens the menu with social links and both copy options', async () => {
  await open()
  expect(screen.getByRole('link', {name:'Threads'})).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', {name:'X / Twitter'})).toHaveAttribute('href', expect.stringContaining('intent/tweet'))
  expect(screen.queryByRole('button', {name:'More options'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'Copy letter link'}))
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(`https://atinyatlas.com/messages/${message.publicId}`))
  expect(await screen.findByRole('status')).toHaveTextContent('Link copied')
  fireEvent.click(screen.getByRole('button', {name:'Copy Atiny Atlas link'}))
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith('https://atinyatlas.com/'))
})
it('offers selectable text when clipboard permission is denied', async () => {
  clipboard.mockRejectedValue(new Error('denied'))
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Copy letter link'}))
  expect(await screen.findByRole('textbox', {name:'Copy manually'})).toHaveValue(`https://atinyatlas.com/messages/${message.publicId}`)
})
it('loads an image preview, changes format and provides a downloadable PNG', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', {name:'Instagram / Create image'}))
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
  fireEvent.click(screen.getByRole('button', {name:'Instagram / Create image'}))
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
