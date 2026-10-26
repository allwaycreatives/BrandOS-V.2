import Link from 'next/link'
import type { ReactNode } from 'react'
import { APP_NAME, COMPANY, EFFECTIVE_DATE } from '@/lib/legal'

const SERIF = "Georgia, 'Times New Roman', serif"

export function LegalFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', marginTop: 56, padding: '22px 0 40px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <span>© {new Date().getFullYear()} {COMPANY}. {APP_NAME} is made by {COMPANY}.</span>
      <span style={{ display: 'flex', gap: 16 }}>
        <Link href="/privacy" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</Link>
        <Link href="/terms" style={{ color: 'var(--text-secondary)' }}>Terms of Service</Link>
      </span>
    </footer>
  )
}

// Shared page shell for the legal documents.
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 22px 0' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/brandos-logo.png" alt={APP_NAME} style={{ height: 22, width: 'auto' }} />
        </Link>
        <Link href="/sign-in" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sign in</Link>
      </header>
      <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.1 }}>{title}</h1>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>Effective {EFFECTIVE_DATE}</div>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{intro}</p>
      <div className="legal-body">{children}</div>
      <style dangerouslySetInnerHTML={{ __html: `
        .legal-body h2{font-family:${SERIF};font-size:22px;font-weight:600;margin:38px 0 10px}
        .legal-body h3{font-size:15px;font-weight:600;margin:22px 0 6px}
        .legal-body p,.legal-body li{font-size:15.5px;line-height:1.72;color:var(--text-secondary)}
        .legal-body p{margin:0 0 12px}
        .legal-body ul{margin:0 0 14px;padding-left:22px}
        .legal-body li{margin-bottom:6px}
        .legal-body a{color:var(--accent-text);text-decoration:underline}
        .legal-body strong{color:var(--text-primary,inherit);font-weight:600}
        .legal-note{border:1px solid var(--border);background:var(--bg-card);border-radius:12px;padding:14px 16px;margin:16px 0}
      ` }} />
      <LegalFooter />
    </div>
  )
}
