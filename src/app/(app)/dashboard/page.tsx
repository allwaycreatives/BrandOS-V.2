import { db } from '@/lib/db'
import Link from 'next/link'
import { createBrandSpace } from '../../actions'

type BrandSpaceRow = { id: string; name: string }

async function getBrandSpaces(): Promise<BrandSpaceRow[]> {
  try {
    return await db.brandSpace.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    return [
      { id: 'demo-1', name: 'Mara Kline' },
      { id: 'demo-2', name: 'Green Table Co' },
      { id: 'demo-3', name: 'Nia Reyes' },
    ]
  }
}

export default async function DashboardPage() {
  const brandSpaces = await getBrandSpaces()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="topbar-greeting">Your brand spaces</div>
          <div className="topbar-sub">Everything you're managing, in one place.</div>
        </div>
        <form action={createBrandSpace} style={{ display: 'flex', gap: 8 }}>
          <input name="name" required placeholder="Brand or client name" />
          <button className="primary" type="submit">Create</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {brandSpaces.length === 0 && (
          <div className="card-empty">No brand spaces yet — create your first one above.</div>
        )}
        {brandSpaces.map((bs) => (
          <Link key={bs.id} href={`/brand-spaces/${bs.id}`} className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{bs.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Open to view calendar and brand kit</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
