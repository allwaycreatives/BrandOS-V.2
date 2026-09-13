'use client'

import { useState, useTransition } from 'react'
import { updateCalendarItemDetails } from '../actions'

export default function CalendarItemForm({
  brandSpaceId,
  itemId,
  initial,
}: {
  brandSpaceId: string
  itemId: string
  initial: { platform: string; hook: string; keyMessage: string; script: string; caption: string }
}) {
  const [values, setValues] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    startTransition(async () => {
      await updateCalendarItemDetails(brandSpaceId, itemId, values)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  function field(key: keyof typeof values, label: string, isTextarea = false, rows = 3) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
        {isTextarea ? (
          <textarea
            rows={rows}
            style={{ width: '100%' }}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        ) : (
          <input
            style={{ width: '100%' }}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        )}
      </div>
    )
  }

  return (
    <div className="card">
      {field('platform', 'Platform')}
      {field('hook', 'Hook — the first line that stops the scroll')}
      {field('keyMessage', 'Key message — the one thing this piece needs to communicate')}
      {field('script', 'Script', true, 6)}
      {field('caption', 'Caption', true, 4)}

      <button className="primary" onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}
