'use client'

import {useEffect, useState} from 'react'
import type {Locale} from '@/i18n/locale'
export type LetterImageFormat = 'story' | 'square'

/** Prepare files before the click: native sharing requires a fresh user activation. */
export function useLetterShareFiles(publicId:string, locale:Locale, enabled:boolean, generation:number) {
  const [result, setResult] = useState<{generation:number; files:Partial<Record<LetterImageFormat, File>>}>({generation:-1, files:{}})
  const [doneGeneration, setDoneGeneration] = useState(-1)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    async function prepare(format:LetterImageFormat) {
      const response = await fetch(`/api/messages/${encodeURIComponent(publicId)}/share-image?format=${format}&locale=${locale}`, {signal:controller.signal, cache:'no-store'})
      if (!response.ok) throw new Error('image-unavailable')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      const file = new File([blob], `atiny-atlas-${publicId}-${format}.png`, {type:'image/png'})
      setResult(previous => ({generation, files:{...(previous.generation === generation ? previous.files : {}), [format]:file}}))
    }
    void Promise.allSettled([prepare('story'), prepare('square')]).then(() => {if (!controller.signal.aborted) setDoneGeneration(generation)})
    return () => controller.abort()
  }, [publicId, locale, enabled, generation])
  return {files:result.generation === generation ? result.files : {}, loading:enabled && doneGeneration !== generation}
}
