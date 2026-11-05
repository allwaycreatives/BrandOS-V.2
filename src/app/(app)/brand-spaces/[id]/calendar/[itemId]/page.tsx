import Link from 'next/link'
import PostView from './PostView'

// The full-page version of a post. Inside the calendar a post opens as a panel instead; this is what a direct link or a refresh shows.
export default async function CalendarItemPage(props: { params: Promise<{ id: string; itemId: string }> }) {
  const params = await props.params;
  return (
    <div style={{ maxWidth: 760 }}>
      <Link href={`/brand-spaces/${params.id}/calendar`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Calendar
      </Link>
      <div style={{ marginTop: 16 }}>
        <PostView brandSpaceId={params.id} itemId={params.itemId} />
      </div>
    </div>
  )
}
