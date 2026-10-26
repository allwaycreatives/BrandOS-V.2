import Link from 'next/link'
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '24px 0' }}>
      <SignIn />
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, margin: 0 }}>
        By continuing you agree to our <Link href="/terms" style={{ textDecoration: 'underline' }}>Terms of Service</Link> and <Link href="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</Link>.
      </p>
    </div>
  )
}
