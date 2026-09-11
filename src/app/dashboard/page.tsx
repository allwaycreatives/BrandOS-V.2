import { db } from '@/lib/db'

type BrandSpaceRow = { id: string; name: string }

async function getBrandSpaces(): Promise<BrandSpaceRow[]> {
  try {
    return await db.brandSpace.findMany({ select: { id: true, name: true } })
  } catch {
    // No database configured yet — fall back to placeholder data so the
    // UI is visible immediately. Set DATABASE_URL and run `prisma migrate dev`
    // to connect this to a real Postgres instance.
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Your brand spaces</h1>
        <button className="primary">New brand space</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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
