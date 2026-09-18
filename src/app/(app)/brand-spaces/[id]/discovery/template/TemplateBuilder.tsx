'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveCustomTemplate, revertToDefaultTemplate } from './actions'

type Row = { section: string; prompt: string; helper: string }

export default function TemplateBuilder({
  brandSpaceId,
  hasActiveCustomTemplate,
}: {
  brandSpaceId: string
  hasActiveCustomTemplate: boolean
}) {
  const [name, setName] = useState('')
  const [rows, setRows] = useState<Row[]>([{ section: '', prompt: '', helper: '' }])
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    // Carry the last row's section forward, since consecutive questions
    // are usually in the same section — matches how the car-rental example
    // was grouped.
    const lastSection = rows[rows.length - 1]?.section || ''
    setRows((prev) => [...prev, { section: lastSection, prompt: '', helper: '' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    startTransition(async () => {
      await saveCustomTemplate(brandSpaceId, name, rows)
      router.push(`/brand-spaces/${brandSpaceId}`)
    })
  }

  function handleRevert() {
    startTransition(async () => {
      await revertToDefaultTemplate(brandSpaceId)
      router.push(`/brand-spaces/${brandSpaceId}`)
    })
  }

  return (
    <div>
      {hasActiveCustomTemplate && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--border-strong)' }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            A custom questionnaire is currently active for this brand space's discovery link.
          </div>
          <button onClick={handleRevert} disabled={isPending}>
            Revert to the default quiz
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Questionnaire name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Car Rental Deep Intake" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Question {i + 1}</span>
              <button type="button" onClick={() => removeRow(i)} style={{ padding: '2px 8px', fontSize: 11 }}>Remove</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={row.section}
                onChange={(e) => updateRow(i, 'section', e.target.value)}
                placeholder="Section heading, e.g. 🎯 Business & Sales Goals"
              />
              <textarea
                rows={2}
                value={row.prompt}
                onChange={(e) => updateRow(i, 'prompt', e.target.value)}
                placeholder="The question itself"
              />
              <input
                value={row.helper}
                onChange={(e) => updateRow(i, 'helper', e.target.value)}
                placeholder="Optional helper text shown under the question"
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button type="button" onClick={addRow}>+ Add question</button>
        <button className="primary" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save & activate'}
        </button>
      </div>
    </div>
  )
}
