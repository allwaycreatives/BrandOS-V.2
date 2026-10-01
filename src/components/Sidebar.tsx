'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type SidebarBrand = { id: string; name: string; color: string; role?: string }

export default function Sidebar({ brands }: { brands: SidebarBrand[] }) {
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

  const mainItems = [
    { label: 'Home', href: '/dashboard', icon: '⌂' },
    { label: 'My tasks', href: '/tasks', icon: '☑' },
    { label: 'Projects', href: '/projects', icon: '▣' },
    { label: 'Campaigns', href: '/campaigns', icon: '◈' },
    { label: 'Ideas', href: '/ideas', icon: '✧' },
  ]

  const allBrandItems = brandSpaceId
    ? [
        { label: 'Overview', href: `/brand-spaces/${brandSpaceId}`, icon: '◧' },
        { label: 'Discovery', href: `/brand-spaces/${brandSpaceId}/discovery`, icon: '◎' },
        { label: 'Brand Kit', href: `/brand-spaces/${brandSpaceId}/brand-kit`, icon: '✦' },
        { label: 'Projects', href: `/brand-spaces/${brandSpaceId}/projects`, icon: '▣' },
        { label: 'Campaigns', href: `/brand-spaces/${brandSpaceId}/campaigns`, icon: '◈' },
        { label: 'Ideas', href: `/brand-spaces/${brandSpaceId}/ideas`, icon: '✧' },
        { label: 'Calendar', href: `/brand-spaces/${brandSpaceId}/calendar`, icon: '▦' },
        { label: 'Boards', href: `/brand-spaces/${brandSpaceId}/boards`, icon: '▤' },
        { label: 'Tasks', href: `/brand-spaces/${brandSpaceId}/tasks`, icon: '☑' },
        { label: 'Notion', href: `/brand-spaces/${brandSpaceId}/notion`, icon: '◐' },
        { label: 'People', href: `/brand-spaces/${brandSpaceId}/people`, icon: '☺' },
      ]
    : []

  // Show only what this person can actually open.
  const currentRole = brands.find((b) => b.id === brandSpaceId)?.role
  const brandItems = allBrandItems.filter((item) => {
    if (currentRole === 'client') return !['Projects', 'Campaigns', 'Ideas', 'People'].includes(item.label)
    if (item.label === 'People') return currentRole === 'owner'
    return true
  })

  function renderLink(item: { label: string; href: string; icon: string }) {
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
  }

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

      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {mainItems.map(renderLink)}

        {!collapsed && <div className="sidebar-label" style={{ marginTop: 18 }}>Brands</div>}
        {collapsed && <div style={{ height: 14 }} />}
        {brands.map((b) => {
          const isCurrent = brandSpaceId === b.id
          return (
            <Link
              key={b.id}
              href={`/brand-spaces/${b.id}`}
              title={collapsed ? b.name : undefined}
              className={`sidebar-link${isCurrent && pathname === `/brand-spaces/${b.id}` ? ' active' : ''}`}
              style={collapsed ? { justifyContent: 'center' } : isCurrent ? { color: 'var(--text-primary)' } : undefined}
            >
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>}
            </Link>
          )
        })}
        {brands.length === 0 && !collapsed && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px' }}>No brands yet</div>
        )}

        {brandItems.length > 0 && (
          <>
            {!collapsed && <div className="sidebar-label" style={{ marginTop: 18 }}>This brand</div>}
            {collapsed && <div style={{ height: 14 }} />}
            {brandItems.map(renderLink)}
          </>
        )}
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
