import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <span className="badge">MVP · Sprint 1</span>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
