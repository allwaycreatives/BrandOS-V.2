import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import CalendarItemForm from './CalendarItemForm'

export default async function CalendarItemPage({ params }: { params: { id: string; itemId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()

  const item = await db.calendarItem.findUnique({ where: { id: params.itemId } }).catch(() => null)
  if (!item || item.brandSpaceId !== params.id) notFound()

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href={`/brand-spaces/${params.id}/calendar`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Calendar
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">{item.title}</div>
        <div className="topbar-sub">Status: {item.status.replace('_', ' ')}</div>
      </div>

      <CalendarItemForm
        brandSpaceId={params.id}
        itemId={item.id}
        initial={{
          platform: item.platform,
          hook: item.hook || '',
          keyMessage: item.keyMessage || '',
          script: item.script || '',
          caption: item.caption || '',
        }}
      />
    </div>
  )
}
