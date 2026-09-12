import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
      <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 64, height: 64, objectFit: 'contain' }} />
      <img src="/brandos-logo.png" alt="BrandOS" style={{ height: 48 }} />
      <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>
        The operating system for creators, brands, and the agencies serving them.
      </p>
      <Link href="/dashboard">
        <button className="primary">Go to dashboard</button>
      </Link>
    </main>
  )
}
