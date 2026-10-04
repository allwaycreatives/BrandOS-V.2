import FounderSetup from './FounderSetup'

const SERIF = "Georgia, 'Times New Roman', serif"

export default function FounderSetupPage() {
  return (
    <div>
      <div className="topbar-greeting">Founders and a shared brand</div>
      <div className="topbar-sub" style={{ marginBottom: 22, maxWidth: 620 }}>
        For founders who build something together. You get one shared brand and a personal brand for each founder, linked, so the story stays consistent and each voice stays their own.
      </div>

      <FounderSetup />

      <div className="card" style={{ maxWidth: 560, marginTop: 24 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>What gets created</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div><strong>The shared brand</strong> starts with a Brand architecture board (decide what is shared and what is personal, platform by platform) and the Brand bible.</div>
          <div><strong>Each founder&apos;s brand</strong> starts with a Founder profile board: story, voice, platforms and content angles.</div>
          <div><strong>A first task</strong> on the shared brand: decide which platforms are shared and which are personal.</div>
        </div>
      </div>
    </div>
  )
}
