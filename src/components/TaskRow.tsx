import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = { open: 'To do', in_progress: 'In progress', done: 'Done' }

export function formatDue(d: Date | null): string {
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
}

export default function TaskRow({
  title,
  status,
  dueDate,
  brand,
  overdue,
}: {
  title: string
  status: string
  dueDate: Date | null
  brand: { id: string; name: string; color: string }
  overdue?: boolean
}) {
  return (
    <Link
      href={`/brand-spaces/${brand.id}/tasks`}
      className="task-row"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: brand.color, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{STATUS_LABEL[status] ?? status}</span>
      {dueDate && (
        <span style={{ fontSize: 11.5, color: overdue ? 'var(--accent)' : 'var(--text-secondary)', minWidth: 48, textAlign: 'right' }}>
          {formatDue(dueDate)}
        </span>
      )}
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {brand.name}
      </span>
    </Link>
  )
}
