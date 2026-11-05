import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { LegalFooter } from '@/components/LegalPage'
import BrandLogo from '@/components/BrandLogo'
import { APP_NAME, COMPANY } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: `${APP_NAME}: the operating system for creative brands`,
  description: `${APP_NAME} helps creatives discover their brand, manage their work, get client approvals, and deliver photos and videos in full quality, all in one place.`,
}

const SERIF = "Georgia, 'Times New Roman', serif"

const FEATURES = [
  { icon: '◎', title: 'Brand discovery & strategy', text: 'Guided questions that turn a vague idea into a clear brand: positioning, voice and a brand kit you can actually use.' },
  { icon: '▣', title: 'Projects, tasks & campaigns', text: 'Plan the work, assign it, and see what is due. One calm place for every brand you look after.' },
  { icon: '▦', title: 'Content calendar', text: 'Schedule what goes out and when, and keep ideas parked until they are ready.' },
  { icon: '✔', title: 'Client reviews & approvals', text: 'Send work for review with one private link. Clients comment and approve without needing an account.' },
  { icon: '▥', title: 'Photo & video delivery', text: 'Deliver full-quality photos and videos, even gigabytes of them, in a beautiful gallery with a passcode, expiry date and one-click download.' },
  { icon: '▤', title: 'Boards', text: 'Mood boards and shot lists to get everyone on the same page before the work begins.' },
]

export default function HomePage() {
  // People who are signed in go straight to their dashboard; everyone else sees this page.
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '26px 22px 0' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandLogo variant="full" height={56} alt={APP_NAME} />
        <nav style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 14 }}>
          <Link href="/sign-in" style={{ color: 'var(--text-secondary)' }}>Sign in</Link>
          <Link href="/sign-up" style={{ padding: '8px 16px', borderRadius: 999, background: 'var(--accent)', color: '#000', fontWeight: 600 }}>Get started</Link>
        </nav>
      </header>

      <section style={{ textAlign: 'center', padding: 'clamp(56px, 11vw, 120px) 0 clamp(44px, 8vw, 84px)' }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(38px, 7vw, 74px)', lineHeight: 1.05, letterSpacing: '-0.01em', margin: '0 auto', maxWidth: 820 }}>
          The operating system for creative brands.
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 640, margin: '22px auto 32px' }}>
          Discover your brand, manage the work, get client approvals, and deliver photos and videos in full quality, all in one place.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sign-up" style={{ padding: '13px 26px', borderRadius: 999, background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 15 }}>Create your account</Link>
          <Link href="/sign-in" style={{ padding: '13px 26px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 15 }}>Sign in</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 14 }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="card" style={{ padding: '20px 20px 22px' }}>
            <div style={{ fontSize: 22, color: 'var(--accent-text)', marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{f.text}</div>
          </div>
        ))}
      </section>

      <section id="google-drive" className="card" style={{ marginTop: 44, padding: 'clamp(22px, 4vw, 34px)' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 600, margin: '0 0 10px' }}>Your files stay in your Google Drive</h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 10px', maxWidth: 760 }}>
          When you deliver photos and videos, you can connect your own Google Drive so the files are kept in your space, not ours. {APP_NAME} asks only for permission to the files and folders it creates itself (a “Brand Console Galleries” folder), so it can never see the rest of your Drive. Your clients download through a private, branded {APP_NAME} link, and you stay in control with a passcode, an expiry date and a download switch.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-muted)', margin: 0 }}>
          Read exactly how we handle Google data in our <Link href="/privacy#google" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>Privacy Policy</Link>.
        </p>
      </section>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 44 }}>{APP_NAME} is made by {COMPANY}.</p>
      <LegalFooter />
    </div>
  )
}
