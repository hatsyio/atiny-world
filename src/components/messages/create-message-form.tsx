'use client'

import { useState } from 'react'

import Link from 'next/link'

import { RECIPIENTS, type Recipient } from '@/domain/contracts'
import { MAX_GRAPHEMES, countGraphemes } from '@/domain/messages/content'

export type CreateMessageFormSubmitState =
  | { kind: 'idle' }
  | { kind: 'cooldown'; retryAfterSeconds: number }
  | { kind: 'limit' }

export interface CreateMessageFormProps {
  recipient: Recipient | null
  onRecipientChange: (recipient: Recipient | null) => void
  submitState: CreateMessageFormSubmitState
  onSubmit: () => Promise<void> | void
}

export function CreateMessageForm({
  recipient,
  onRecipientChange,
  submitState,
  onSubmit,
}: CreateMessageFormProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)

  const graphemeCount = countGraphemes(content)
  const limitReached = graphemeCount > MAX_GRAPHEMES
  const cooldownActive = submitState.kind === 'cooldown'
  const limitActive = submitState.kind === 'limit'

  const publishDisabled =
    isSending || cooldownActive || limitActive || graphemeCount === 0 || limitReached

  function handleRecipientChange(value: string) {
    const next =
      (RECIPIENTS as readonly string[]).includes(value) ? (value as Recipient) : null
    onRecipientChange(next)
  }

  async function handlePublish() {
    if (isSending) return
    setIsSending(true)
    try {
      await onSubmit()
    } catch {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="message-content">message.content</label>
      <textarea
        id="message-content"
        name="content"
        aria-label="message.content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <output htmlFor="message-content">
        {graphemeCount}/{MAX_GRAPHEMES}
      </output>
      {limitReached && <p role="alert">message.content.limitReached</p>}

      <label htmlFor="message-recipient">message.recipient</label>
      <select
        id="message-recipient"
        name="recipient"
        aria-label="message.recipient"
        value={recipient ?? ''}
        onChange={(event) => handleRecipientChange(event.target.value)}
      >
        <option value=""> — </option>
        {RECIPIENTS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {cooldownActive && (
        <p role="status">message.cooldown {submitState.retryAfterSeconds}</p>
      )}
      {limitActive && (
        <p>
          <Link href="/my-messages">message.limitReached.link</Link>
        </p>
      )}

      <button type="submit" disabled={publishDisabled} onClick={handlePublish}>
        message.publish
      </button>
      <button type="button" disabled={isSending}>
        message.cancel
      </button>
    </form>
  )
}
