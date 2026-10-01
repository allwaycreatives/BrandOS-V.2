import { UserButton } from '@clerk/nextjs'
import Sidebar from '@/components/Sidebar'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { db } from '@/lib/db'
import NotificationBell from '@/components/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = await getUserBrands(user.id, organizationId)
  const recent = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 8 }).catch(() => [])
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } }).catch(() => 0)

  return (
    <div className="app-shell">
      <Sidebar brands={brands} />
      <div className="main-area">
        <div className="topbar" style={{ justifyContent: 'flex-end' }}>
          <NotificationBell
            unread={unread}
            items={recent.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: !!n.readAt, createdAt: n.createdAt.toISOString() }))}
          />
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
