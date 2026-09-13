'use client'

import { useMemo, useState } from 'react'
import { discoveryQuestions } from '@/lib/discoveryQuestions'
import { submitDiscoveryResponse } from './actions'

type Answers = Record<string, string | string[]>

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        left: Math.random() * 100,
        color: ['#f5a623', '#ffffff', '#ff6b6b', '#4dd4ac', '#6c8cff'][i % 5],
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
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const question = discoveryQuestions[step]
  const isLast = step === discoveryQuestions.length - 1
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
    await submitDiscoveryResponse(brandSpaceId, answers)
    setSubmitting(false)
    setDone(true)
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

  return (
    <div key={step} className="card question-slide">
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        Question {step + 1} of {discoveryQuestions.length}
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((step + 1) / discoveryQuestions.length) * 100}%`,
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
                  color: selected ? 'var(--accent)' : undefined,
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
            return (
              <button
                key={option}
                onClick={() => toggleMultiSelect(option)}
                className={selected ? 'option-selected' : undefined}
                style={{
                  borderRadius: 999,
                  borderColor: selected ? 'var(--accent)' : undefined,
                  background: selected ? 'var(--accent-dim)' : undefined,
                  color: selected ? 'var(--accent)' : undefined,
                }}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </button>
        <button className="primary" onClick={handleContinue} disabled={!canContinue || submitting}>
          {submitting ? 'Saving...' : isLast ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
