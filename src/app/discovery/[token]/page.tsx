// Public, no-login discovery form. A client reaches this via a unique
// shareable link (email/WhatsApp/SMS) — see Decision 4 in the PRD.
// `token` resolves server-side to a DiscoveryTemplateVersion; wiring that
// lookup up is a Sprint 2 task (Technical-Architecture-MVP.md Section 4).

export default function DiscoveryPage({ params }: { params: { token: string } }) {
  return (
    <main style={{ maxWidth: 480, margin: '3rem auto', padding: '0 1rem' }}>
      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Step 1 of 8</div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 24 }}>
          <div style={{ height: '100%', width: '12%', background: 'var(--accent)', borderRadius: 2 }} />
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>What's the story behind your brand?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          A couple of sentences is plenty — you can always refine this later.
        </p>
        <textarea
          rows={4}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit' }}
          placeholder="e.g. I started coaching after burning out in corporate finance..."
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="primary">Continue</button>
        </div>
      </div>
    </main>
  )
}
