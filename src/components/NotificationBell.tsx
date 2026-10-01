'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { markRead, markAllRead } from '@/app/notificationActions'

type Item = { id: string; title: string; body: string | null; href: string; read: boolean; createdAt: string }

export default function NotificationBell({ items, unread }: { items: Item[]; unread: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function readAll() {
    await markAllRead()
    router.refresh()
  }

  return (
    <div style={{ position: 'relative', marginRight: 14 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Updates" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
        Updates
        {unread > 0 && (
          <span style={{ background: 'var(--accent)', color: '#000', borderRadius: 10, fontSize: 11, fontWeight: 600, padding: '0 6px', lineHeight: '17px' }}>{unread}</span>
        )}
      </button>

      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 30, padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Updates</span>
            {unread > 0 && (
              <button type="button" onClick={readAll} style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', padding: 0 }}>Mark all read</button>
            )}
          </div>
          {items.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing yet. Client feedback shows up here.</div>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => {
                setOpen(false)
                markRead(n.id).then(() => router.refresh())
              }}
              style={{ display: 'block', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(255,255,255,0.03)' }}
            >
              <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
