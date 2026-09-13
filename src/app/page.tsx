import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
      <div className="logo-glow-wrap splash-fade">
        <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 64, height: 64, objectFit: 'contain' }} />
      </div>
      <img src="/brandos-logo.png" alt="BrandOS" style={{ height: 48 }} className="splash-fade splash-delay-1" />
      <p style={{ color: 'var(--text-secondary)', marginTop: -8 }} className="splash-fade splash-delay-2">
        The operating system for creators, brands, and the agencies serving them.
      </p>
      <div className="splash-fade splash-delay-3">
        <Link href="/dashboard">
          <button className="primary">Go to dashboard</button>
        </Link>
      </div>
    </main>
  )
}
