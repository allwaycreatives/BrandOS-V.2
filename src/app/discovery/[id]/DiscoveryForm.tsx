'use client'

import { useState } from 'react'
import { discoveryQuestions } from '@/lib/discoveryQuestions'
import { submitDiscoveryResponse } from './actions'

type Answers = Record<string, string | string[]>

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
    setAnswer(
      existing.includes(option) ? existing.filter((o) => o !== option) : [...existing, option]
    )
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
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>That's everything — thank you.</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
          Your answers have been saved. The team working on your brand will take it from here.
        </div>
      </div>
    )
  }

  return (
    <div className="card">
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
            transition: 'width 0.2s ease',
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
          {question.options?.map((option) => (
            <button
              key={option}
              onClick={() => setAnswer(option)}
              style={{
                textAlign: 'left',
                borderColor: currentValue === option ? 'var(--accent)' : undefined,
                background: currentValue === option ? 'var(--accent-dim)' : undefined,
                color: currentValue === option ? 'var(--accent)' : undefined,
              }}
            >
              {option}
            </button>
          ))}
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
