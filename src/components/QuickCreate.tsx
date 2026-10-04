'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { quickCreateTask, createBrandSpace } from '@/app/actions'
import { createIdea } from '@/app/(app)/brand-spaces/[id]/ideas/actions'
import { createCampaign } from '@/app/(app)/brand-spaces/[id]/campaigns/actions'
import { createProject } from '@/app/(app)/brand-spaces/[id]/projects/actions'

type Brand = { id: string; name: string }

// One tidy box for creating anything, instead of five separate forms.
const TABS = [
  { key: 'task', label: 'Task', field: 'title', placeholder: 'e.g. Edit the launch reel', button: 'Add task', needsBrand: true, action: quickCreateTask },
  { key: 'idea', label: 'Idea', field: 'title', placeholder: 'e.g. Behind-the-scenes series', button: 'Save idea', needsBrand: true, action: createIdea },
  { key: 'campaign', label: 'Campaign', field: 'name', placeholder: 'e.g. Summer launch', button: 'Create campaign', needsBrand: true, action: createCampaign },
  { key: 'project', label: 'Project', field: 'name', placeholder: 'e.g. Brand film', button: 'Create project', needsBrand: true, action: createProject },
  { key: 'brand', label: 'Brand', field: 'name', placeholder: 'Brand or client name', button: 'Create brand', needsBrand: false, action: createBrandSpace },
] as const

export default function QuickCreate({ brands }: { brands: Brand[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('task')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const current = TABS.find((t) => t.key === tab)!

  async function submit(formData: FormData) {
    const typed = String(formData.get(current.field) || '').trim()
    setBusy(true)
    setMsg(null)
    try {
      await current.action(formData)
      // Tasks and ideas stay on this page, so clear the box and say it worked.
      formRef.current?.reset()
      if (current.key === 'task' || current.key === 'idea') {
        setMsg(`Added “${typed}”`)
        setTimeout(() => setMsg(null), 3000)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 28 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setMsg(null)
            }}
            style={{
              padding: '5px 14px',
              fontSize: 13,
              borderRadius: 999,
              background: tab === t.key ? 'var(--accent-dim)' : 'transparent',
              borderColor: tab === t.key ? 'var(--accent)' : 'var(--border-strong)',
              color: tab === t.key ? 'var(--accent-text)' : 'var(--text-secondary)',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form key={tab} ref={formRef} action={submit} className="qc-row">
        <input name={current.field} required placeholder={current.placeholder} className="qc-main" autoComplete="off" />
        {current.needsBrand &&
          (brands.length > 1 ? (
            <select name="brandSpaceId" defaultValue={brands[0].id} className="qc-brand" aria-label="Brand">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="brandSpaceId" value={brands[0]?.id ?? ''} />
          ))}
        <button className="primary qc-go" type="submit" disabled={busy}>
          {busy ? 'Working...' : current.button}
        </button>
      </form>
      {msg && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>{msg}</div>}
      {tab === 'brand' && (
        <div style={{ fontSize: 12.5, marginTop: 10 }}>
          <Link href="/setup/founders" style={{ color: 'var(--accent-text)' }}>Building a brand around two or more founders? Use the founder setup →</Link>
        </div>
      )}
    </div>
  )
}
