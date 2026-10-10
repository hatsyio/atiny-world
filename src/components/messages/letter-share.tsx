'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components'
import type { PublicMessageDetail } from '@/domain/messages/public-message'
import { prepareLetterShare, type SocialDestination } from '@/domain/messages/letter-share'
import { copyShareValue, LetterShareFeedback, wasShareCancelled, type ShareFeedback } from './letter-share-feedback'
import { LetterShareImageDialog } from './letter-share-image-dialog'

const socials: {id:SocialDestination; label:string; mark:string}[] = [
  {id:'threads', label:'Threads', mark:'@'}, {id:'x', label:'X / Twitter', mark:'X'},
  {id:'whatsapp', label:'WhatsApp', mark:'W'}, {id:'telegram', label:'Telegram', mark:'T'},
  {id:'facebook', label:'Facebook', mark:'f'}, {id:'linkedin', label:'LinkedIn', mark:'in'},
  {id:'pinterest', label:'Pinterest', mark:'P'},
]
const subscribe = () => () => {}
const nativeSupported = () => typeof navigator.share === 'function'
const serverSupported = () => false

export function LetterShare({message, origin}: {message:PublicMessageDetail; origin:string}) {
  const t = useTranslations('Forms.share')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [feedback, setFeedback] = useState<ShareFeedback>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const canShare = useSyncExternalStore(subscribe, nativeSupported, serverSupported)
  const share = prepareLetterShare(message, locale, origin)
  const copy = (value:string) => copyShareValue(value, t('copied'), t('copyFallback'), setFeedback)
  async function nativeShare() {
    setFeedback(null)
    try { await navigator.share({title:t('title'), text:share.text}) }
    catch (error) { if (!wasShareCancelled(error)) setFeedback({kind:'error', message:t('nativeError')}) }
  }
  function closeImage() {
    setImageOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  return <div className="letter-share">
    <DialogTrigger isOpen={open} onOpenChange={value => {setOpen(value); if (value) setFeedback(null)}}>
      <Button ref={trigger} className="letter-share-trigger">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12 3 0 12M7 8l5-5 5 5M5 13v7h14v-7" /></svg>
        {t('button')}
      </Button>
      <Popover className="letter-share-popover" placement="bottom end" offset={10}>
        <Dialog className="letter-share-menu">
          <header className="letter-share-menu-header"><Heading slot="title">{t('title')}</Heading><Button className="letter-share-close" aria-label={t('close')} onPress={() => setOpen(false)}>×</Button></header>
          <p className="letter-share-menu-intro">{t('intro')}</p>
          <div className="letter-share-socials">
            {socials.map(social => <a key={social.id} href={share.destinations[social.id]} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span className="letter-share-social-mark" aria-hidden="true">{social.mark}</span><span>{social.label}</span></a>)}
            <Button onPress={() => {setOpen(false); setImageOpen(true)}}><span className="letter-share-social-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></span><span>{t('instagram')}</span></Button>
          </div>
          <div className="letter-share-menu-actions">
            <Button onPress={() => {void copy(share.url)}}>{t('copyLetter')}</Button>
            <Button onPress={() => {void copy(new URL('/', origin).toString())}}>{t('copyApp')}</Button>
            {canShare ? <Button onPress={() => {void nativeShare()}}>{t('more')}</Button> : null}
          </div>
          <LetterShareFeedback feedback={feedback} />
        </Dialog>
      </Popover>
    </DialogTrigger>
    {imageOpen ? <LetterShareImageDialog message={message} origin={origin} onClose={closeImage} /> : null}
  </div>
}
