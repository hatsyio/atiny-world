'use client'

import { useId, useState, type ReactNode } from 'react'

export function AdminDisclosure({ label, context, children }: { label: string; context: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="admin-disclosure">
    <button type="button" className="admin-disclosure-toggle" aria-label={`${label}: ${context}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {label}
      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m5 8 5 5 5-5" /></svg>
    </button>
    <div id={id} className="admin-disclosure-content" hidden={!open}>{children}</div>
  </div>
}
