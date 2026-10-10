'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import type { PublicMessageDetail } from '@/domain/messages/public-message'
import { prepareLetterShare } from '@/domain/messages/letter-share'
import { copyShareValue, LetterShareFeedback, wasShareCancelled, type ShareFeedback } from './letter-share-feedback'

export function LetterShareImageDialog({message, origin, onClose}: {message:PublicMessageDetail; origin:string; onClose:() => void}) {
  const t = useTranslations('Forms.share')
  const locale = useLocale()
  const [format, setFormat] = useState<'story' | 'square'>('story')
  const [attempt, setAttempt] = useState(0)
  const [resource, setResource] = useState<{key:string; url:string; file:File} | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState<ShareFeedback>(null)
  const key = `${format}:${attempt}`
  const ready = resource?.key === key ? resource : null
  const failed = failedKey === key
  const share = prepareLetterShare(message, locale, origin)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    async function load() {
      try {
        const response = await fetch(`/api/messages/${encodeURIComponent(message.publicId)}/share-image?format=${format}&locale=${locale}`, {signal:controller.signal, cache:'no-store'})
        if (!response.ok) throw new Error('image-unavailable')
        const blob = await response.blob()
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setResource({key:`${format}:${attempt}`, url:objectUrl, file:new File([blob], `atiny-atlas-${message.publicId}-${format}.png`, {type:'image/png'})})
      } catch {
        if (!controller.signal.aborted) setFailedKey(`${format}:${attempt}`)
      }
    }
    void load()
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [message.publicId, format, locale, attempt])

  let canShareFile = false
  try { canShareFile = Boolean(ready && typeof navigator.share === 'function' && navigator.canShare?.({files:[ready.file]})) } catch { /* Keep download available. */ }
  async function shareImage() {
    if (!ready || sharing) return
    setSharing(true)
    setFeedback(null)
    try { await navigator.share({files:[ready.file]}) }
    catch (error) { if (!wasShareCancelled(error)) setFeedback({kind:'error', message:t('nativeError')}) }
    finally { setSharing(false) }
  }
  const copy = (value:string, text = false) => copyShareValue(value, t(text ? 'textCopied' : 'copied'), t('copyFallback'), setFeedback)
  return <ModalOverlay className="letter-share-image-overlay" isOpen isDismissable onOpenChange={open => { if (!open) onClose() }}>
    <Modal className="letter-share-image-modal">
      <Dialog className="letter-share-image-dialog">
        <header className="letter-share-image-header">
          <div><Heading slot="title">{t('imageTitle')}</Heading><p>{t('imageIntro')}</p></div>
          <Button className="letter-share-close" aria-label={t('close')} onPress={onClose}>×</Button>
        </header>
        <div className="letter-share-image-layout">
          <div className="letter-share-preview" data-format={format} aria-busy={!ready && !failed}>
            {ready ? <Image src={ready.url} alt={t('previewAlt', {author:message.author.displayName})} width={1080} height={format === 'story' ? 1920 : 1080} unoptimized /> :
              <div className="letter-share-preview-status">{failed ? <><p role="alert">{t('imageError')}</p><Button className="letter-share-secondary" onPress={() => setAttempt(value => value + 1)}>{t('retry')}</Button></> : <p role="status">{t('generating')}</p>}</div>}
          </div>
          <div className="letter-share-image-options">
            <div className="letter-share-formats" role="group" aria-label={t('format')}>
              <Button aria-pressed={format === 'story'} onPress={() => setFormat('story')}>{t('story')}</Button>
              <Button aria-pressed={format === 'square'} onPress={() => setFormat('square')}>{t('square')}</Button>
            </div>
            <p className="letter-share-image-hint">{t('instagramHint')}</p>
            {ready ? <a className="letter-share-primary" href={ready.url} download={ready.file.name}>{t('download')}</a> : <Button className="letter-share-primary" isDisabled>{t('download')}</Button>}
            {canShareFile ? <Button className="letter-share-secondary" isDisabled={sharing} onPress={() => {void shareImage()}}>{t('shareImage')}</Button> : null}
            <label className="letter-share-caption">{t('preparedText')}<textarea readOnly value={share.text} onFocus={event => event.currentTarget.select()} /></label>
            <div className="letter-share-copy-actions">
              <Button className="letter-share-secondary" onPress={() => {void copy(share.text, true)}}>{t('copyText')}</Button>
              <Button className="letter-share-secondary" onPress={() => {void copy(share.url)}}>{t('copyLetter')}</Button>
            </div>
            <LetterShareFeedback feedback={feedback} />
          </div>
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>
}
