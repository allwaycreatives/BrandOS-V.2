'use client'

import type { UploadPhase } from '@/lib/uploadFile'

export type UploadView = {
  name: string
  percent: number
  status: UploadPhase | 'queued' | 'saving' | 'done' | 'error'
  error?: string
}

const LABEL: Record<UploadView['status'], string> = {
  queued: 'Waiting…',
  preparing: 'Optimizing image…',
  uploading: 'Uploading…',
  retrying: 'Connection hiccup, retrying…',
  saving: 'Adding to board…',
  done: 'Done',
  error: 'Failed',
}

// A small progress bar for one upload: shows the file name, percent, and Cancel / Retry / Dismiss.
export default function UploadBar({
  item,
  onCancel,
  onRetry,
  onDismiss,
}: {
  item: UploadView
  onCancel?: () => void
  onRetry?: () => void
  onDismiss?: () => void
}) {
  const failed = item.status === 'error'
  const done = item.status === 'done'
  const working = !failed && !done
  const indeterminate = item.status === 'preparing' || item.status === 'retrying' || item.status === 'saving'
  const pct = done ? 100 : Math.max(0, Math.min(100, item.percent))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, minWidth: 0 }}>
      <style>{'@keyframes uploadbar-pulse{0%,100%{opacity:.35}50%{opacity:1}}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={item.name}>
          {item.name}
        </span>
        <span style={{ flex: '0 0 auto', color: failed ? 'var(--accent-text)' : 'var(--text-muted)' }}>
          {item.status === 'uploading' ? `${pct}%` : done ? '✓' : ''}
        </span>
        {working && onCancel && (
          <button type="button" onClick={onCancel} aria-label={`Cancel upload of ${item.name}`} style={{ padding: '0 6px', fontSize: 11, border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
            Cancel
          </button>
        )}
        {failed && onRetry && (
          <button type="button" onClick={onRetry} style={{ padding: '0 6px', fontSize: 11 }}>Retry</button>
        )}
        {(failed || done) && onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ padding: '0 6px', fontSize: 11, border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>✕</button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={`Upload of ${item.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate || failed ? undefined : pct}
        style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            width: indeterminate ? '100%' : `${failed ? 100 : pct}%`,
            background: failed ? '#d64545' : 'var(--accent)',
            transition: 'width .15s linear',
            animation: indeterminate ? 'uploadbar-pulse 1.1s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <span style={{ color: failed ? 'var(--accent-text)' : 'var(--text-muted)' }}>
        {failed ? item.error ?? LABEL.error : item.status === 'uploading' || done ? '' : LABEL[item.status]}
      </span>
    </div>
  )
}
