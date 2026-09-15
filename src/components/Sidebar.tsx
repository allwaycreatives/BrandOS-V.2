const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '◧', active: true },
  { label: 'Discovery', href: '#', icon: '◎', soon: true },
  { label: 'Brand Kit', href: '#', icon: '✦', soon: true },
  { label: 'Calendar', href: '#', icon: '▦', soon: true },
  { label: 'Boards', href: '#', icon: '▤', soon: true },
  { label: 'Team', href: '#', icon: '◐', soon: true },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-glow-wrap">
          <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }} />
        </div>
        <img
          src="/brandos-logo.png"
          alt="BrandOS"
          style={{ height: 18, display: 'block' }}
          className="splash-fade splash-delay-1"
        />
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        <div className="sidebar-label">Navigate</div>
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`sidebar-link${item.active ? ' active' : ''}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
            {item.soon && <span className="soon">Soon</span>}
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <img src="/aw-logo.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: 0.7 }} />
        <span>by All Way Creatives</span>
      </div>
    </aside>
  )
}
