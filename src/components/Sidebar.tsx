'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// The open brand's tools, grouped so eleven items read as three.
const GROUP_OF: Record<string, string> = {
  Overview: '', Discovery: 'Brand', 'Brand Kit': 'Brand', Boards: 'Brand', Family: 'Brand',
  Projects: 'Work', Campaigns: 'Work', Ideas: 'Work', Calendar: 'Work', Tasks: 'Work',
  Reviews: 'Clients', People: 'Clients',
}
const GROUPS = ['', 'Brand', 'Work', 'Clients']

type SidebarBrand = { id: string; name: string; color: string; role?: string; parentId?: string | null }

export default function Sidebar({ brands }: { brands: SidebarBrand[] }) {
  const pathname = usePathname()
  const [collapsedPref, setCollapsed] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [open, setOpen] = useState(false)
  // On phones the sidebar is a drawer and always shows full labels.
  const collapsed = collapsedPref && !mobile

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Close the drawer whenever you go somewhere.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

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

  // Founder brands sit just under the shared brand they belong to.
  const roots = brands.filter((b) => !b.parentId || !brands.some((x) => x.id === b.parentId))
  const ordered = roots.flatMap((r) => [r, ...brands.filter((c) => c.parentId === r.id)])

  const mainItems = [
    { label: 'Home', href: '/dashboard', icon: '⌂' },
    { label: 'My tasks', href: '/tasks', icon: '☑' },
    { label: 'Projects', href: '/projects', icon: '▣' },
    { label: 'Campaigns', href: '/campaigns', icon: '◈' },
    { label: 'Ideas', href: '/ideas', icon: '✧' },
    { label: 'Templates', href: '/templates', icon: '❏' },
  ]

  const hasFamily = !!brandSpaceId && (brands.some((b) => b.parentId === brandSpaceId) || !!brands.find((b) => b.id === brandSpaceId)?.parentId)
  const allBrandItems = brandSpaceId
    ? [
        { label: 'Overview', href: `/brand-spaces/${brandSpaceId}`, icon: '◧' },
        { label: 'Discovery', href: `/brand-spaces/${brandSpaceId}/discovery`, icon: '◎' },
        { label: 'Strategy', href: `/brand-spaces/${brandSpaceId}/strategy`, icon: '◇' },
        { label: 'Brand Kit', href: `/brand-spaces/${brandSpaceId}/brand-kit`, icon: '✦' },
        { label: 'Projects', href: `/brand-spaces/${brandSpaceId}/projects`, icon: '▣' },
        { label: 'Campaigns', href: `/brand-spaces/${brandSpaceId}/campaigns`, icon: '◈' },
        { label: 'Ideas', href: `/brand-spaces/${brandSpaceId}/ideas`, icon: '✧' },
        { label: 'Reviews', href: `/brand-spaces/${brandSpaceId}/reviews`, icon: '✔' },
        { label: 'Calendar', href: `/brand-spaces/${brandSpaceId}/calendar`, icon: '▦' },
        { label: 'Boards', href: `/brand-spaces/${brandSpaceId}/boards`, icon: '▤' },
        { label: 'Tasks', href: `/brand-spaces/${brandSpaceId}/tasks`, icon: '☑' },
        { label: 'People', href: `/brand-spaces/${brandSpaceId}/people`, icon: '☺' },
        ...(hasFamily ? [{ label: 'Family', href: `/brand-spaces/${brandSpaceId}/family`, icon: '❖' }] : []),
      ]
    : []

  // Show only what this person can actually open.
  const currentRole = brands.find((b) => b.id === brandSpaceId)?.role
  const brandItems = allBrandItems.filter((item) => {
    if (currentRole === 'client') return !['Strategy', 'Projects', 'Campaigns', 'Ideas', 'Reviews', 'People', 'Family'].includes(item.label)
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
    <>
    <button type="button" className="mobile-menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>
    {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
    <aside className={`sidebar${open ? ' open' : ''}`} style={{ width: collapsed ? 64 : 220 }}>
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
        {ordered.map((b) => {
          const isCurrent = brandSpaceId === b.id
          const isChild = !!b.parentId && roots.some((r) => r.id === b.parentId)
          return (
            <div key={b.id} style={{ marginLeft: !collapsed && isChild ? 12 : 0 }}>
              <Link
                href={`/brand-spaces/${b.id}`}
                title={collapsed ? b.name : undefined}
                className="sidebar-link"
                style={collapsed ? { justifyContent: 'center' } : isCurrent ? { color: 'var(--text-primary)', fontWeight: 600 } : undefined}
              >
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>}
              </Link>
              {isCurrent && brandItems.length > 0 && (
                <div className="sidebar-sub" style={collapsed ? undefined : { marginLeft: 14, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
                  {GROUPS.map((g) => {
                    const items = brandItems.filter((i) => GROUP_OF[i.label] === g)
                    if (items.length === 0) return null
                    return (
                      <div key={g || 'top'}>
                        {g && !collapsed && <div className="sidebar-label" style={{ marginTop: 10, marginBottom: 2, fontSize: 10.5 }}>{g}</div>}
                        {items.map(renderLink)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {brands.length === 0 && !collapsed && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px' }}>No brands yet</div>
        )}

      </nav>

      <button
        type="button"
        className="sidebar-collapse-btn"
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
    </>
  )
}
