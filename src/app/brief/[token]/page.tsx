import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { db } from '@/lib/db'
import BriefForm from './BriefForm'

const SERIF = "Georgia, 'Times New Roman', serif"

// Public brief form. A client opens the link (often sent on WhatsApp), fills it in, and the team gets a project.
export default async function BriefPage({ params }: { params: { token: string } }) {
  const brand = await db.brandSpace.findUnique({ where: { intakeToken: params.token }, select: { name: true } }).catch(() => null)
  if (!brand) notFound()

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><ThemeToggle /></div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Brief</div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, margin: '0 0 8px' }}>Send a brief to {brand.name}</h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 22px' }}>
        Tell us what you need. It takes about two minutes, and there is nothing to sign up for.
      </p>
      <BriefForm token={params.token} brandName={brand.name} />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>Made with Brand Console</div>
    </main>
  )
}
