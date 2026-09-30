'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brandColor } from '@/lib/brandColor'
import { STARTER_PACKS, type StarterPack } from '@/lib/starterPacks'
import { createBrandForOnboarding, addTaskToBrand } from '@/app/actions'
import { createBoardsFromTemplate } from '@/app/(app)/brand-spaces/[id]/boards/actions'

type TemplateItem = { key: string; name: string; description: string; boardCount: number; boardNames: string[] }

const SERIF = "Georgia, 'Times New Roman', serif"
const H2: React.CSSProperties = { fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: '0 0 8px' }
const LEAD: React.CSSProperties = { fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }

export default function FirstRun({ templates }: { templates: TemplateItem[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [pack, setPack] = useState<StarterPack | null>(null)
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
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

  function choosePack(p: StarterPack) {
    setPack(p)
    setSelected(p.templates)
    setTaskTitle(p.taskSuggestion)
    setStep(1)
  }

  const createBrand = () =>
    run(async () => {
      const res = await createBrandForOnboarding(name)
      setBrandId(res.brandSpaceId)
      setStep(2)
    })

  const addTemplates = () =>
    run(async () => {
      const made: string[] = []
      for (const key of selected) {
        await createBoardsFromTemplate(brandId, key)
        const t = templates.find((x) => x.key === key)
        if (t) made.push(...t.boardNames)
      }
      setBoards(made)
      setStep(3)
    })

  const addTask = () =>
    run(async () => {
      if (taskTitle.trim()) {
        await addTaskToBrand(brandId, taskTitle)
        setTask(taskTitle.trim())
      }
      setStep(4)
    })

  const finish = () => {
    router.refresh()
    router.push(`/brand-spaces/${brandId}`)
  }

  const toggle = (key: string) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  const sorted = [...templates].sort((a, b) => Number(pack?.templates.includes(b.key)) - Number(pack?.templates.includes(a.key)))
  const color = brandColor(name || 'Brand')

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--border)' }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, alignItems: 'start' }}>
        <div>
          {step === 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 1 of 4</div>
              <h2 style={H2}>What best describes you?</h2>
              <p style={LEAD}>We will set up a starting point that fits how you work. You can change everything later.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STARTER_PACKS.map((p) => (
                  <button key={p.key} type="button" onClick={() => choosePack(p)} style={{ textAlign: 'left', padding: 12, display: 'block', width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{p.blurb}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && pack && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 2 of 4</div>
              <h2 style={H2}>{pack.nameTitle}</h2>
              <p style={LEAD}>{pack.nameHelp}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && !busy && createBrand()} placeholder={pack.namePlaceholder} style={{ width: '100%', marginBottom: 12 }} autoFocus />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="primary" onClick={createBrand} disabled={busy || !name.trim()}>{busy ? 'Creating...' : 'Continue'}</button>
                <button type="button" onClick={() => setStep(0)} disabled={busy} style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text-muted)', padding: 0 }}>Back</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 3 of 4</div>
              <h2 style={H2}>Start from a template</h2>
              <p style={LEAD}>Each one arrives with example content you can edit. We picked the ones that suit you.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {sorted.map((t) => {
                  const on = selected.includes(t.key)
                  const rec = pack?.templates.includes(t.key)
                  return (
                    <button key={t.key} type="button" onClick={() => toggle(t.key)} disabled={busy} style={{ textAlign: 'left', padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', borderColor: on ? 'var(--accent)' : undefined }}>
                      <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--border-strong)', background: on ? 'var(--accent)' : 'transparent', flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</span>
                        {rec && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 8 }}>Recommended</span>}
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <button className="primary" onClick={selected.length ? addTemplates : () => setStep(3)} disabled={busy}>
                {busy ? 'Adding...' : selected.length ? `Add ${selected.length} ${selected.length === 1 ? 'template' : 'templates'}` : 'Skip, start blank'}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Step 4 of 4</div>
              <h2 style={H2}>Add your first task</h2>
              <p style={LEAD}>What is the next small thing to do for {name}? We suggested one, change it if you like.</p>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && addTask()} style={{ width: '100%', marginBottom: 12 }} autoFocus />
              <button className="primary" onClick={addTask} disabled={busy}>{busy ? 'Adding...' : taskTitle.trim() ? 'Add task' : 'Skip'}</button>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={H2}>{name} is ready</h2>
              <p style={LEAD}>Next you can invite a client or teammate, start a project or campaign, or duplicate this brand for the next one.</p>
              <button className="primary" onClick={finish}>Open {name}</button>
            </>
          )}

          {error && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12 }}>{error}</div>}
        </div>

        <div className="card" style={{ minHeight: 220 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Your workspace{pack ? ` · ${pack.label}` : ''}</div>
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
