'use client'

import { useEffect, useMemo, useState } from 'react'
import { submitDiscoveryResponse } from './actions'

type LongFormQuestion = { id: string; section?: string; prompt: string; helper?: string }
type Answers = Record<string, string>

function draftKey(brandSpaceId: string) {
  return `discovery-draft:${brandSpaceId}`
}

export default function LongFormDiscoveryForm({
  brandSpaceId,
  questions,
}: {
  brandSpaceId: string
  questions: LongFormQuestion[]
}) {
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(brandSpaceId))
      if (raw) {
        const draft = JSON.parse(raw)
        if (!draft.readyToSync) setAnswers(draft.answers || {})
      }
    } catch {
      // Start fresh if storage is unavailable or corrupted.
    }
    setRestored(true)
  }, [brandSpaceId])

  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(draftKey(brandSpaceId), JSON.stringify({ answers, readyToSync: false }))
    } catch {
      // Non-critical.
    }
  }, [brandSpaceId, answers, restored])

  const sections = useMemo(() => {
    const grouped: { section: string; questions: LongFormQuestion[] }[] = []
    for (const q of questions) {
      const section = q.section || 'Questions'
      const existing = grouped.find((g) => g.section === section)
      if (existing) existing.questions.push(q)
      else grouped.push({ section, questions: [q] })
    }
    return grouped
  }, [questions])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (!navigator.onLine) throw new Error('offline')
      await submitDiscoveryResponse(brandSpaceId, answers)
      localStorage.removeItem(draftKey(brandSpaceId))
      setDone(true)
    } catch {
      localStorage.setItem(draftKey(brandSpaceId), JSON.stringify({ answers, readyToSync: true }))
      setSavedOffline(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="card bounce-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Thanks — that's everything.</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Your answers have been saved and the team will take it from here.
        </div>
      </div>
    )
  }

  if (savedOffline) {
    return (
      <div className="card bounce-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📶</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Saved on this device.</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          No connection right now — this will sync automatically once you're back online.
        </div>
      </div>
    )
  }

  const answeredCount = questions.filter((q) => (answers[q.id] || '').trim().length > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {answeredCount} of {questions.length} answered — take your time, come back anytime before submitting.
      </div>

      {sections.map((group) => (
        <div key={group.section} className="card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{group.section}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {group.questions.map((q) => (
              <div key={q.id}>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{q.prompt}</div>
                {q.helper && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{q.helper}</div>}
                <textarea
                  rows={3}
                  style={{ width: '100%' }}
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="primary" onClick={handleSubmit} disabled={submitting} style={{ alignSelf: 'center', padding: '12px 28px' }}>
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  )
}
