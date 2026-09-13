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
          <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }} />
        </div>
        <div className="splash-fade splash-delay-1 sidebar-brand-wordmark">
          <img src="/brandos-logo.png" alt="BrandOS" style={{ height: 14, display: 'block' }} />
          <div className="sidebar-brand-sub">by All Way Creatives</div>
        </div>
      </div>

      <nav className="sidebar-nav">
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
    </aside>
  )
}

