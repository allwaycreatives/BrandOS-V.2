import FounderSetup from './FounderSetup'

export default function FounderSetupPage() {
  return (
    <div>
      <div className="topbar-greeting">Founders and a company brand</div>
      <div className="topbar-sub" style={{ marginBottom: 22, maxWidth: 620 }}>
        For founders who build something together. Start with the company brand and list the founders as its faces. Their personal brands can come later, when you are ready, and feed the company.
      </div>

      <FounderSetup />
    </div>
  )
}
