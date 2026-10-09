import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { parseStrategy } from '@/lib/strategy'
import StrategyForm from './StrategyForm'

export default async function StrategyPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access

  if (access.role === 'client') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="topbar-greeting">Content strategy</div>
        <div className="card-empty" style={{ marginTop: 16 }}>This page is for the team.</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Content strategy</div>
        <div className="topbar-sub">The decisions that guide what gets made. Posts in the calendar are tagged with these pillars and series.</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/brand-spaces/${params.id}/import?kind=strategy`} style={{ fontSize: 13, color: 'var(--accent-text)' }}>Fill this in from ChatGPT →</Link>
      </div>
      <StrategyForm brandSpaceId={params.id} initial={parseStrategy(brandSpace!.strategy)} />
    </div>
  )
}
