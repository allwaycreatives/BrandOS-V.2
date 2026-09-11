import { db } from '@/lib/db'
import { createBrandSpace } from '../actions'

type BrandSpaceRow = { id: string; name: string }

async function getBrandSpaces(): Promise<BrandSpaceRow[]> {
  try {
    return await db.brandSpace.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // No database configured yet — fall back to placeholder data so the
    // UI is visible immediately.
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
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Your brand spaces</h1>
        <form action={createBrandSpace} style={{ display: 'flex', gap: 8 }}>
          <input
            name="name"
            required
            placeholder="Brand or client name"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit' }}
          />
          <button className="primary" type="submit">Create</button>
        </form>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {brandSpaces.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No brand spaces yet — create your first one above.
          </div>
        )}
        {brandSpaces.map((bs) => (
          <div key={bs.id} className="card">
            <div style={{ fontWeight: 500, marginBottom: 8 }}>{bs.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Open to view calendar and brand kit</div>
          </div>
        ))}
      </div>
    </main>
  )
}
