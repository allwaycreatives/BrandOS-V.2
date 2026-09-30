import { UserButton } from '@clerk/nextjs'
import Sidebar from '@/components/Sidebar'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = await getUserBrands(user.id, organizationId)

  return (
    <div className="app-shell">
      <Sidebar brands={brands} />
      <div className="main-area">
        <div className="topbar" style={{ justifyContent: 'flex-end' }}>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
