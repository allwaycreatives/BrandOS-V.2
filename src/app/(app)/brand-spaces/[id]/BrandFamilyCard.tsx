'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBrandParent } from './familyActions'

export default function BrandFamilyCard({ brandSpaceId, parentId, options }: { brandSpaceId: string; parentId: string | null; options: { id: string; name: string }[] }) {
  const router = useRouter()
  const [value, setValue] = useState(parentId ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await setBrandParent(brandSpaceId, value || null)
      if (res.ok) {
        setMsg('Saved.')
        router.refresh()
      } else setMsg(res.error || 'Could not save.')
    })
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Brand family</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        Link this brand under a shared brand, like a founder&apos;s personal brand under the company or duo brand.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Part of" style={{ flex: '1 1 160px' }}>
          <option value="">Stands on its own</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>Part of {o.name}</option>
          ))}
        </select>
        <button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
