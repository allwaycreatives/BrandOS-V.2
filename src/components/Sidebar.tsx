'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const brandSpaceMatch = pathname.match(/\/brand-spaces\/([^/]+)/)
  const brandSpaceId = brandSpaceMatch?.[1]

  const navItems = brandSpaceId
    ? [
        { label: 'All brand spaces', href: '/dashboard', icon: '◧' },
        { label: 'Brand space home', href: `/brand-spaces/${brandSpaceId}`, icon: '⌂' },
        { label: 'Discovery', href: `/brand-spaces/${brandSpaceId}/discovery`, icon: '◎' },
        { label: 'Brand Kit', href: `/brand-spaces/${brandSpaceId}/brand-kit`, icon: '✦' },
        { label: 'Calendar', href: `/brand-spaces/${brandSpaceId}/calendar`, icon: '▦' },
        { label: 'Boards', href: `/brand-spaces/${brandSpaceId}/boards`, icon: '▤' },
        { label: 'Tasks', href: `/brand-spaces/${brandSpaceId}/tasks`, icon: '☑' },
        { label: 'Notion', href: `/brand-spaces/${brandSpaceId}/notion`, icon: '◐' },
      ]
    : [{ label: 'Dashboard', href: '/dashboard', icon: '◧' }]

  return (
    <aside className="sidebar" style={{ width: collapsed ? 64 : 220 }}>
      <div className="sidebar-brand" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div className="logo-glow-wrap">
          <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }} />
        </div>
        {!collapsed && (
          <img
            src="/brandos-logo.png"
            alt="BrandOS"
            style={{ height: 18, display: 'block' }}
            className="splash-fade splash-delay-1"
          />
        )}
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {!collapsed && <div className="sidebar-label">{brandSpaceId ? 'This brand space' : 'Navigate'}</div>}
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`sidebar-link${isActive ? ' active' : ''}`}
              style={collapsed ? { justifyContent: 'center' } : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        style={{
          margin: '0 6px 8px',
          padding: '6px 0',
          fontSize: 12,
          background: 'transparent',
          border: '1px solid var(--border-strong)',
        }}
      >
        {collapsed ? '»' : '« Collapse'}
      </button>

      <div className="sidebar-footer" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <img src="/aw-logo.png" alt="" style={{ width: 14, height: 14, objectFit: 'contain', opacity: 0.7 }} />
        {!collapsed && <span>by All Way Creatives</span>}
      </div>
    </aside>
  )
}
