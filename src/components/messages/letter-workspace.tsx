import type { ReactNode } from 'react'

/** The same reading surface and properties column for every letter mode. */
export function LetterWorkspace({ content, properties }: { content: ReactNode; properties: ReactNode }) {
  return (
    <div className="letter-workspace">
      <div className="letter-workspace__paper">{content}</div>
      <div className="letter-workspace__properties">{properties}</div>
    </div>
  )
}
