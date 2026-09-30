'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brandColor } from '@/lib/brandColor'
import { createBrandForOnboarding, addTaskToBrand } from '@/app/actions'
import { createBoardsFromTemplate } from '@/app/(app)/brand-spaces/[id]/boards/actions'

type TemplateItem = { key: string; name: string; description: string; boardCount: number; boardNames: string[] }

const SERIF = "Georgia, 'Times New Roman', serif"

export default function FirstRun({ templates }: { templates: TemplateItem[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [boards, setBoards] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const createBrand = () =>
    run(async () => {
      const res = await createBrandForOnboarding(name)
      setBrandId(res.brandSpaceId)
      setStep(1)
    })

  const pickTemplate = (t: TemplateItem | null) =>
    run(async () => {
      if (t) {
        await createBoardsFromTemplate(brandId, t.key)
        setBoards(t.boardNames)
      }
      setStep(2)
    })

  const addTask = () =>
    run(async () => {
      if (taskTitle.trim()) {
        await addTaskToBrand(brandId, taskTitle)
        setTask(taskTitle.trim())
      }
      setStep(3)
    })

  const finish = () => {
    router.refresh()
    router.push(`/brand-spaces/${brandId}`)
  }

  const color = brandColor(name || 'Brand')

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--border)' }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, alignItems: 'start' }}>
        <div>
          {step === 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 1 of 3</div>
              <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 8px' }}>Name your brand</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                A brand is one person, business or client. Everything you plan for it lives together. You can rename it later.
              </p>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && !busy && createBrand()} placeholder="Nova Studio" style={{ width: '100%', marginBottom: 12 }} autoFocus />
              <button className="primary" onClick={createBrand} disabled={busy || !name.trim()}>{busy ? 'Creating...' : 'Continue'}</button>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 2 of 3</div>
              <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 8px' }}>Start from a template</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Each one arrives with example content you can edit, so you never start from a blank page.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {templates.map((t) => (
                  <button key={t.key} type="button" onClick={() => pickTemplate(t)} disabled={busy} style={{ textAlign: 'left', padding: 12, display: 'block', width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => pickTemplate(null)} disabled={busy} style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text-muted)', padding: 0 }}>Skip, I will start blank</button>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 3 of 3</div>
              <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 8px' }}>Add your first task</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>What is the next small thing you need to do for {name}?</p>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && addTask()} placeholder="Write the brand bio" style={{ width: '100%', marginBottom: 12 }} autoFocus />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="primary" onClick={addTask} disabled={busy}>{busy ? 'Adding...' : taskTitle.trim() ? 'Add task' : 'Skip'}</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 8px' }}>{name} is ready</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                Next you can invite a client or teammate, plan a campaign, or duplicate this brand for the next one.
              </p>
              <button className="primary" onClick={finish}>Open {name}</button>
            </>
          )}

          {error && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12 }}>{error}</div>}
        </div>

        <div className="card" style={{ minHeight: 220 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Your workspace</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ fontWeight: 600, opacity: name ? 1 : 0.35 }}>{name || 'Your brand'}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Boards</div>
          {boards.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>None yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {boards.map((b) => (
                <div key={b} style={{ fontFamily: SERIF, fontSize: 13.5 }}>{b}</div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Tasks</div>
          <div style={{ fontSize: 13, color: task ? undefined : 'var(--text-muted)' }}>{task || 'None yet'}</div>
        </div>
      </div>
    </div>
  )
}
