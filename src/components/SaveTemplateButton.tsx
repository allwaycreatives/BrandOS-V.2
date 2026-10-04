'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { saveAsTemplate } from '@/app/(app)/templates/actions'

export default function SaveTemplateButton({ kind, sourceId, defaultName }: { kind: 'board' | 'campaign' | 'project'; sourceId: string; defaultName: string }) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    const name = prompt('Name this template', defaultName)
    if (name === null) return
    setMsg(null)
    startTransition(async () => {
      try {
        const res = await saveAsTemplate(kind, sourceId, name)
        setMsg(res.ok ? { text: 'Saved.', ok: true } : { text: res.error || 'Could not save.', ok: false })
      } catch {
        setMsg({ text: 'Could not save.', ok: false })
      }
    })
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving...' : 'Save as template'}</button>
      {msg && (
        <span style={{ fontSize: 12, color: msg.ok ? 'var(--text-secondary)' : 'var(--accent-text)' }}>
          {msg.text} {msg.ok && <Link href="/templates" style={{ color: 'var(--accent-text)' }}>See templates</Link>}
        </span>
      )}
    </span>
  )
}
