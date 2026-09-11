import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
      <h1>BrandOS</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        The operating system for creators, brands, and the agencies serving them.
      </p>
      <Link href="/dashboard">
        <button className="primary">Go to dashboard</button>
      </Link>
    </main>
  )
}
