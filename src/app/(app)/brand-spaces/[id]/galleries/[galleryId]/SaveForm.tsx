'use client'

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'

// A form that saves like any other, but says "Saving…" and then "Saved", so you can see that it worked.
export default function SaveForm({ action, children, className, style }: { action: (fd: FormData) => Promise<unknown>; children: ReactNode; className?: string; style?: CSSProperties }) {
  const [pending, start] = useTransition()
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  return (
    <form
      className={className}
      style={style}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setState('idle')
        start(async () => {
          try {
            await action(fd)
            setState('saved')
            setTimeout(() => setState('idle'), 4000)
          } catch {
            setState('error')
          }
        })
      }}
    >
      {children}
      {(pending || state !== 'idle') && (
        <div role="status" style={{ gridColumn: '1 / -1', fontSize: 13, color: state === 'error' ? '#c0392b' : 'var(--accent-text)' }}>
          {pending ? 'Saving…' : state === 'saved' ? '✓ Saved. Your client’s page now shows it.' : 'Could not save. Please try again.'}
        </div>
      )}
    </form>
  )
}
