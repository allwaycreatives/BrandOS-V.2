'use client'

import { useEffect, useMemo, useState } from 'react'
import { getQuestionsForTrack, engagementTypes } from '@/lib/discoveryQuestions'
import { submitDiscoveryResponse } from './actions'

type Answers = Record<string, string | string[]>

function draftKey(brandSpaceId: string) {
  return `discovery-draft:${brandSpaceId}`
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        left: Math.random() * 100,
        color: ['#ff6929', '#ffffff', '#ff6b6b', '#4dd4ac', '#6c8cff'][i % 5],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1.3,
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 6,
      })),
    []
  )

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            opacity: 0.9,
            borderRadius: 2,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export default function DiscoveryForm({ brandSpaceId }: { brandSpaceId: string }) {
  const [engagementType, setEngagementType] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [restored, setRestored] = useState(false)

  // Restore any in-progress draft for this brand space on load — this is
  // what lets someone close the app mid-flow and pick back up later.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(brandSpaceId))
      if (raw) {
        const draft = JSON.parse(raw)
        if (!draft.readyToSync) {
          setEngagementType(draft.engagementType || null)
          setStep(draft.step || 0)
          setAnswers(draft.answers || {})
        }
      }
    } catch {
      // Ignore corrupt/unavailable storage — just start fresh.
    }
    setRestored(true)
  }, [brandSpaceId])

  // Save progress to the device continuously, so nothing is lost if the
  // connection drops or the tab closes mid-flow.
  useEffect(() => {
    if (!restored || !engagementType) return
    try {
      localStorage.setItem(
        draftKey(brandSpaceId),
        JSON.stringify({ engagementType, step, answers, readyToSync: false })
      )
    } catch {
      // Storage full or unavailable — not critical, just skip saving.
    }
  }, [brandSpaceId, engagementType, step, answers, restored])

  const questions = useMemo(() => (engagementType ? getQuestionsForTrack(engagementType) : []), [engagementType])

  const question = questions[step]
  const isLast = step === questions.length - 1
  const currentValue = answers[question?.id]

  const canContinue =
    question?.type === 'multi-select'
      ? Array.isArray(currentValue) && currentValue.length > 0
      : typeof currentValue === 'string' && currentValue.trim().length > 0

  function setAnswer(value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
  }

  function toggleMultiSelect(option: string) {
    const existing = Array.isArray(currentValue) ? currentValue : []
    setAnswer(existing.includes(option) ? existing.filter((o) => o !== option) : [...existing, option])
  }

  async function handleContinue() {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }

    setSubmitting(true)
    const finalAnswers = { ...answers, engagement_type: engagementType || 'both' }

    try {
      if (!navigator.onLine) throw new Error('offline')
      await submitDiscoveryResponse(brandSpaceId, finalAnswers)
      localStorage.removeItem(draftKey(brandSpaceId))
      setDone(true)
    } catch {
      // No connection (or the request failed) — keep it safe on the device
      // and sync automatically the moment we're back online.
      localStorage.setItem(
        draftKey(brandSpaceId),
        JSON.stringify({ engagementType, step, answers: finalAnswers, readyToSync: true })
      )
      setSavedOffline(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <>
        <Confetti />
        <div className="card bounce-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>That's everything — nailed it.</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Your answers have been saved. The team working on your brand will take it from here.
          </div>
        </div>
      </>
    )
  }

  if (savedOffline) {
    return (
      <div className="card bounce-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📶</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Saved on this device.</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          No connection right now, but nothing is lost — this will sync automatically the moment this device is back online.
        </div>
      </div>
    )
  }

  if (!engagementType) {
    return (
      <div className="card question-slide">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>What do you want help with?</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          This decides which questions you'll see — no need to answer anything that doesn't apply to you.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {engagementTypes.map((option) => (
            <button
              key={option.id}
              onClick={() => setEngagementType(option.id)}
              style={{ textAlign: 'left', padding: '12px 14px' }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{option.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{option.description}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div key={step} className="card question-slide">
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Question {step + 1} of {questions.length}
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((step + 1) / questions.length) * 100}%`,
            background: 'var(--accent)',
            borderRadius: 2,
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{question.prompt}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{question.helper}</div>

      {question.type === 'text' && (
        <textarea
          rows={4}
          style={{ width: '100%' }}
          placeholder="Type your answer..."
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )}

      {question.type === 'choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options?.map((option) => {
            const selected = currentValue === option
            return (
              <button
                key={option}
                onClick={() => setAnswer(option)}
                className={selected ? 'option-selected' : undefined}
                style={{
                  textAlign: 'left',
                  borderColor: selected ? 'var(--accent)' : undefined,
                  background: selected ? 'var(--accent-dim)' : undefined,
                  color: selected ? 'var(--accent-text)' : undefined,
                }}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {question.type === 'multi-select' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {question.options?.map((option) => {
            const selected = Array.isArray(currentValue) && currentValue.includes(option)
            const isPrimary = question.showPrimaryOrder && Array.isArray(currentValue) && currentValue[0] === option
            return (
              <button
                key={option}
                onClick={() => toggleMultiSelect(option)}
                className={selected ? 'option-selected' : undefined}
                style={{
                  borderRadius: 999,
                  borderColor: selected ? 'var(--accent)' : undefined,
                  background: selected ? 'var(--accent-dim)' : undefined,
                  color: selected ? 'var(--accent-text)' : undefined,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {option}
                {isPrimary && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#16110a', padding: '1px 6px', borderRadius: 999 }}>
                    PRIMARY
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button
          onClick={() => (step === 0 ? setEngagementType(null) : setStep((s) => Math.max(0, s - 1)))}
        >
          Back
        </button>
        <button className="primary" onClick={handleContinue} disabled={!canContinue || submitting}>
          {submitting ? 'Saving...' : isLast ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
