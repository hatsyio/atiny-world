'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components'
import type { ShareLetter } from '@/domain/messages/letter-share'
import { prepareLetterShare, type SocialDestination } from '@/domain/messages/letter-share'
import { copyShareValue, LetterShareFeedback, wasShareCancelled, type ShareFeedback } from './letter-share-feedback'
import { useLetterShareFiles, type LetterImageFormat } from './use-letter-share-files'
import { LetterShareImageDialog } from './letter-share-image-dialog'

const socials: {id:SocialDestination; label:string; mark:string}[] = [
  {id:'threads', label:'Threads', mark:'@'}, {id:'x', label:'X / Twitter', mark:'X'},
  {id:'whatsapp', label:'WhatsApp', mark:'W'}, {id:'telegram', label:'Telegram', mark:'T'},
  {id:'facebook', label:'Facebook', mark:'f'},
  {id:'pinterest', label:'Pinterest', mark:'P'},
]
const subscribe = () => () => {}
const nativeSupported = () => typeof navigator.share === 'function'
const serverSupported = () => false
const nativeFilesSupported = () => {
  try { return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({files:[new File([''], 'letter.png', {type:'image/png'})]})) }
  catch { return false }
}

export function LetterShare({message, origin}: {message:ShareLetter; origin:string}) {
  const t = useTranslations('Forms.share')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [sending, setSending] = useState(false)
  const [imageFormat, setImageFormat] = useState<'story' | 'square' | null>(null)
  const [feedback, setFeedback] = useState<ShareFeedback>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const canShare = useSyncExternalStore(subscribe, nativeSupported, serverSupported)
  const canShareFiles = useSyncExternalStore(subscribe, nativeFilesSupported, serverSupported)
  const {files, loading} = useLetterShareFiles(message.publicId, locale, open && canShareFiles, generation)
  const share = prepareLetterShare(message, locale, origin)
  const copy = (value:string) => copyShareValue(value, t('copied'), t('copyFallback'), setFeedback)
  async function nativeShare() {
    setFeedback(null)
    try { await navigator.share({title:t('title'), text:share.text}) }
    catch (error) { if (!wasShareCancelled(error)) setFeedback({kind:'error', message:t('nativeError')}) }
  }
  async function sendImage(format:LetterImageFormat, destination?:'x' | 'threads') {
    const file = files[format]
    if (!file) {setOpen(false); setImageFormat(format); return}
    const text = destination === 'x' ? `${new URL(share.destinations.x).searchParams.get('text')}\n${share.url}` : share.text
    const data = destination ? {files:[file], text} : {files:[file]}
    if (!navigator.canShare?.(data)) {setOpen(false); setImageFormat(format); return}
    setSending(true)
    setFeedback(null)
    try { await navigator.share(data); setOpen(false) }
    catch (error) {
      if (!wasShareCancelled(error)) {setOpen(false); setImageFormat(format)}
    } finally {setSending(false)}
  }
  function instagram(format:LetterImageFormat) {
    if (canShareFiles && files[format]) {void sendImage(format)}
    else {setOpen(false); setImageFormat(format)}
  }
  function closeImage() {
    setImageFormat(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return <div className="letter-share">
    <DialogTrigger isOpen={open} onOpenChange={value => {setOpen(value); if (value) {setFeedback(null); setGeneration(current => current + 1)}}}>
      <Button ref={trigger} className="letter-share-trigger">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12 3 0 12M7 8l5-5 5 5M5 13v7h14v-7" /></svg>
        {t('button')}
      </Button>
      <Popover className="letter-share-popover" placement="bottom end" offset={10}>
        <Dialog className="letter-share-menu">
          <header className="letter-share-menu-header"><Heading slot="title">{t('title')}</Heading><Button className="letter-share-close" aria-label={t('close')} onPress={() => setOpen(false)}>×</Button></header>
          <p className="letter-share-menu-intro">{t('intro')}</p>
          <div className="letter-share-socials">
            {socials.map(social => canShareFiles && (social.id === 'x' || social.id === 'threads') && (files.square || loading)
              ? <Button key={social.id} isDisabled={(!files.square && loading) || sending} onPress={() => {void sendImage('square', social.id as 'x' | 'threads')}}><span className="letter-share-social-mark" aria-hidden="true">{social.mark}</span><span>{social.label}</span></Button>
              : <a key={social.id} href={share.destinations[social.id]} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="letter-share-social-mark" aria-hidden="true">{social.mark}</span><span>{social.label}</span></a>)}
            <Button isDisabled={(!files.story && loading) || sending} onPress={() => instagram('story')}><span className="letter-share-social-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></span><span>{t('instagramStory')}</span></Button>
            <Button isDisabled={(!files.square && loading) || sending} onPress={() => instagram('square')}><span className="letter-share-social-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-5 4 3 4-6 4 4"/></svg></span><span>{t('instagramPost')}</span></Button>
          </div>
          <div className="letter-share-menu-actions">
            <Button onPress={() => {void copy(share.url)}}>{t('copyLetter')}</Button>
            {canShare ? <Button onPress={() => {void nativeShare()}}>{t('more')}</Button> : null}
          </div>
          {canShareFiles ? <p className="letter-share-menu-intro" role={loading ? 'status' : undefined}>{t(loading ? 'preparingImages' : files.story && files.square ? 'chooseNetwork' : 'imagesUnavailable')}</p> : null}
          <LetterShareFeedback feedback={feedback} />
        </Dialog>
      </Popover>
    </DialogTrigger>
    {imageFormat ? <LetterShareImageDialog message={message} origin={origin} initialFormat={imageFormat} onClose={closeImage} /> : null}
  </div>
}
